using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using CMS.API.Data;
using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(IAppUserRepository users, ISysConfigRepository sysConfig, TimeProvider clock) : ControllerBase
{
    // AppRole.RoleId; JwtBearer maps the token's `role` claims to ClaimTypes.Role, which [Authorize(Roles)] checks.
    private const string AdminRole = "Admin";
    // Same message for unknown user, inactive user and wrong password.
    private const string InvalidCredentials = "帳號或密碼錯誤";
    private const string SigningKeyMissing = "系統設定 appConfig 未設定 symmetricSecurityKey 或長度不足 32 位元組";
    // 400, not 401: the frontend treats any 401 as "session expired" and signs the user out.
    private const string CurrentPasswordWrong = "目前密碼不正確";
    private const string ConfirmMismatch = "新密碼與確認密碼不一致";

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        var user = await users.GetCredentialAsync(request.UserId);
        var passwordHash = PasswordHasher.Sha256Hex(request.Password);
        if (user is null || !user.IsActive || !HashEquals(user.PasswordHash, passwordHash))
            return Unauthorized(new { message = InvalidCredentials });

        var secret = await SigningKey.ReadAsync(sysConfig);
        if (secret is null)
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = SigningKeyMissing });

        return Ok(new LoginResponse
        {
            UserId = user.UserId,
            UserName = user.UserName,
            AccessToken = AccessTokenBuilder.Build(user.UserId, user.UserName, user.RoleIds, secret, clock.GetUtcNow()),
        });
    }

    /// <summary>
    /// My Profile: updates UserName of the signed-in user. The UserId comes from the JWT `sub` claim only;
    /// the body has no UserId or roles, so neither can be changed here.
    /// </summary>
    [HttpPut("profile")]
    public async Task<ActionResult<ProfileResponse>> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        // JwtBearer maps `sub` to ClaimTypes.NameIdentifier
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var userName = request.UserName.Trim();
        var updated = await users.UpdateUserNameAsync(userId, userName);
        return updated ? Ok(new ProfileResponse { UserId = userId, UserName = userName }) : NotFound();
    }

    /// <summary>
    /// Changes the signed-in user's password (UserId from the JWT). Checks, in order: current password,
    /// complexity (<see cref="PasswordPolicy"/>), new = confirm. Any failure → 400 with a message and nothing changes.
    /// On success PasswordHash = SHA-256(new) and PasswordUpdatedTime = now (UTC). No hash is ever returned.
    /// </summary>
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var user = await users.GetCredentialAsync(userId);
        if (user is null) return NotFound();
        if (!HashEquals(user.PasswordHash, PasswordHasher.Sha256Hex(request.CurrentPassword)))
            return BadRequest(new { message = CurrentPasswordWrong });
        if (!PasswordPolicy.IsValid(request.NewPassword))
            return BadRequest(new { message = PasswordPolicy.Message });
        if (request.NewPassword != request.ConfirmPassword)
            return BadRequest(new { message = ConfirmMismatch });

        var changed = await users.SetPasswordAsync(
            userId, PasswordHasher.Sha256Hex(request.NewPassword), clock.GetUtcNow().UtcDateTime);
        return changed ? NoContent() : NotFound();
    }

    /// <summary>
    /// Admin only: resets the target user's password to SysConfig appConfig `defaultPassword` (read now).
    /// PasswordHash = SHA-256(default), PasswordUpdatedTime = now (UTC). 204 with no body; non-Admin → 403.
    /// </summary>
    [HttpPost("reset-password")]
    [Authorize(Roles = AdminRole)]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        var passwordHash = await DefaultPassword.ReadHashAsync(sysConfig);
        if (passwordHash is null)
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = DefaultPassword.MissingMessage });

        var reset = await users.SetPasswordAsync(request.UserId, passwordHash, clock.GetUtcNow().UtcDateTime);
        return reset ? NoContent() : NotFound();
    }

    private static bool HashEquals(string stored, string computed)
        => CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(stored.ToLowerInvariant()), Encoding.ASCII.GetBytes(computed));
}

using CMS.API.Auth;
using CMS.API.Data;
using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    IAppUserRepository users, ISysConfigRepository sysConfig, LoginThrottle throttle) : ControllerBase
{
    private const string LoginFailed = "帳號或密碼錯誤";

    // Checked when the UserId does not exist, so an unknown account costs the same PBKDF2 time.
    private static readonly string UnknownUserHash = PasswordHasher.Hash(Guid.NewGuid().ToString());

    [AllowAnonymous]
    [EnableRateLimiting(CmsAuth.LoginRateLimitPolicy)]
    [HttpPost("login")]
    public async Task<ActionResult<CurrentUser>> Login([FromBody] LoginRequest request)
    {
        var userId = request.UserId.Trim();
        // Locked out: not even the right password gets in, so guessing on stops paying off.
        if (throttle.IsLockedOut(userId))
            return StatusCode(StatusCodes.Status429TooManyRequests, new { message = CmsAuth.TooManyAttempts });

        var user = await users.GetCredentialAsync(userId);
        var check = PasswordHasher.Verify(user?.PasswordHash ?? UnknownUserHash, request.Password);
        if (user is null || !user.IsActive || check == PasswordCheck.Failed)
        {
            throttle.RecordFailure(userId);
            return Unauthorized(new { message = LoginFailed });
        }
        throttle.Reset(userId);

        if (check == PasswordCheck.SuccessRehashNeeded)
            await users.RehashPasswordAsync(user.Pkid, PasswordHasher.Hash(request.Password));

        // The default password is known to every admin, so it must be replaced even without the flag.
        var mustChange = user.MustChangePassword
            || request.Password == await sysConfig.GetDefaultPasswordAsync();
        await SignInAsync(user, mustChange);
        return Ok(ToCurrentUser(user, mustChange));
    }

    [AllowAnonymous]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }

    [Authorize(Policy = CmsAuth.SignedInPolicy)]
    [HttpGet("me")]
    public async Task<ActionResult<CurrentUser>> Me()
    {
        var user = await CurrentCredentialAsync();
        return user is null ? Unauthorized() : Ok(ToCurrentUser(user, CmsAuth.MustChangePassword(User)));
    }

    [Authorize(Policy = CmsAuth.SignedInPolicy)]
    [HttpPost("change-password")]
    public async Task<ActionResult<CurrentUser>> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var user = await CurrentCredentialAsync();
        if (user is null) return Unauthorized();

        if (PasswordHasher.Verify(user.PasswordHash, request.CurrentPassword) == PasswordCheck.Failed)
            return BadRequest(new { message = "目前密碼不正確" });
        if (request.NewPassword == request.CurrentPassword)
            return BadRequest(new { message = "新密碼不可與目前密碼相同" });
        if (request.NewPassword == await sysConfig.GetDefaultPasswordAsync())
            return BadRequest(new { message = "新密碼不可為系統預設密碼" });

        await users.ChangePasswordAsync(user.Pkid, PasswordHasher.Hash(request.NewPassword));

        // The new PasswordUpdatedTime is the new session stamp: re-issue this session's cookie with it.
        var updated = await users.GetCredentialAsync(user.Pkid);
        if (updated is null) return Unauthorized();
        await SignInAsync(updated, mustChangePassword: false);
        return Ok(ToCurrentUser(updated, mustChangePassword: false));
    }

    private async Task<AppUserCredential?> CurrentCredentialAsync()
        => CmsAuth.UserPkid(User) is { } pkid ? await users.GetCredentialAsync(pkid) : null;

    private Task SignInAsync(AppUserCredential user, bool mustChangePassword)
        => HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            CmsAuth.CreatePrincipal(user, CookieAuthenticationDefaults.AuthenticationScheme, mustChangePassword));

    private static CurrentUser ToCurrentUser(AppUserCredential user, bool mustChangePassword)
        => new()
        {
            UserId = user.UserId,
            UserName = user.UserName,
            MustChangePassword = mustChangePassword,
            IsAdmin = CmsAuth.IsAdmin(user),
        };
}

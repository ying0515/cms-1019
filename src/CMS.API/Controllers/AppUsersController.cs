using CMS.API.Auth;
using CMS.API.Data;
using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/app-users")]
[Authorize(Policy = CmsAuth.AdminPolicy)]
public class AppUsersController(
    IAppUserRepository repository, ISysConfigRepository sysConfig, ILogger<AppUsersController> logger)
    : ControllerBase
{
    private const string DefaultPasswordMissing = "系統設定 appConfig 未設定 defaultPassword";
    // Keeps at least the acting admin able to manage users: nobody can lock the back office out.
    private const string CannotDemoteSelf = "不可移除自己的管理員角色或停用自己的帳號";
    private const string CannotDeleteSelf = "不可刪除自己的帳號";

    [HttpGet]
    public async Task<ActionResult<IEnumerable<AppUser>>> GetAll()
        => Ok(await repository.GetAllAsync());

    [HttpPost("query")]
    public async Task<ActionResult<IEnumerable<AppUser>>> Query([FromBody] AppUserQuery query)
        => Ok(await repository.QueryAsync(query));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AppUser>> GetById(int id)
    {
        var item = await repository.GetByIdAsync(id);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<AppUser>> Create([FromBody] AppUserRequest request)
    {
        request.UserId = request.UserId.Trim();
        request.UserName = request.UserName.Trim();
        if (await repository.UserIdExistsAsync(request.UserId))
            return Conflict(new { message = $"使用者帳號「{request.UserId}」已存在" });

        var passwordHash = await GetDefaultPasswordHashAsync();
        if (passwordHash is null) return DefaultPasswordError();

        try
        {
            var pkid = await repository.CreateAsync(request, passwordHash);
            var created = await repository.GetByIdAsync(pkid);
            return CreatedAtAction(nameof(GetById), new { id = pkid }, created);
        }
        catch (InvalidReferenceException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] AppUserRequest request)
    {
        request.UserName = request.UserName.Trim();
        if (request.Pkid == CmsAuth.UserPkid(User)
            && (!request.IsActive || !request.RoleIds.Contains(CmsAuth.AdminRoleId)))
            return BadRequest(new { message = CannotDemoteSelf });

        try
        {
            var updated = await repository.UpdateAsync(request);
            return updated ? NoContent() : NotFound();
        }
        catch (InvalidReferenceException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Resets PasswordHash to the current default password and forces a change at next login. Takes no body.</summary>
    [HttpPost("{id:int}/reset-password")]
    public async Task<IActionResult> ResetPassword(int id)
    {
        var target = await repository.GetByIdAsync(id);
        if (target is null) return NotFound();

        var passwordHash = await GetDefaultPasswordHashAsync();
        if (passwordHash is null) return DefaultPasswordError();

        var reset = await repository.ResetPasswordAsync(id, passwordHash);
        if (reset)
            logger.LogInformation("{Actor} reset the password of {Target}", User.Identity?.Name, target.UserId);
        return reset ? NoContent() : NotFound();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (id == CmsAuth.UserPkid(User)) return BadRequest(new { message = CannotDeleteSelf });

        var deleted = await repository.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }

    /// <summary>PBKDF2 hash of SysConfig[appConfig].defaultPassword, or null if it is not configured.</summary>
    private async Task<string?> GetDefaultPasswordHashAsync()
        => await sysConfig.GetDefaultPasswordAsync() is { } password ? PasswordHasher.Hash(password) : null;

    private ObjectResult DefaultPasswordError()
        => StatusCode(StatusCodes.Status500InternalServerError, new { message = DefaultPasswordMissing });
}

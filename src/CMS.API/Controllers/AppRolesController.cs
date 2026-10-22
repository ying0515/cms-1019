using CMS.API.Auth;
using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/app-roles")]
[Authorize(Policy = CmsAuth.AdminPolicy)]
public class AppRolesController(IAppRoleRepository repository) : ControllerBase
{
    // The Admin role is what lets anyone manage users and roles: keep it and keep the acting admin in it.
    private const string CannotLeaveAdmin = "不可將自己移出管理員角色";
    private const string CannotDeleteAdmin = "不可刪除管理員角色";

    [HttpGet]
    public async Task<ActionResult<IEnumerable<AppRole>>> GetAll()
        => Ok(await repository.GetAllAsync());

    [HttpPost("query")]
    public async Task<ActionResult<IEnumerable<AppRole>>> Query([FromBody] AppRoleQuery query)
        => Ok(await repository.QueryAsync(query));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AppRole>> GetById(int id)
    {
        var item = await repository.GetByIdAsync(id);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<AppRole>> Create([FromBody] AppRoleRequest request)
    {
        request.RoleId = request.RoleId.Trim();
        if (await repository.RoleIdExistsAsync(request.RoleId))
            return Conflict(new { message = $"角色代碼「{request.RoleId}」已存在" });

        var pkid = await repository.CreateAsync(request);
        var created = await repository.GetByIdAsync(pkid);
        return CreatedAtAction(nameof(GetById), new { id = pkid }, created);
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] AppRoleRequest request)
    {
        // RoleId is not updatable, so the stored role decides whether this is the Admin role.
        var existing = await repository.GetByIdAsync(request.Pkid);
        if (existing is null) return NotFound();
        if (existing.RoleId == CmsAuth.AdminRoleId
            && !request.UserIds.Contains(User.Identity?.Name ?? "", StringComparer.OrdinalIgnoreCase))
            return BadRequest(new { message = CannotLeaveAdmin });

        var updated = await repository.UpdateAsync(request);
        return updated ? NoContent() : NotFound();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if ((await repository.GetByIdAsync(id))?.RoleId == CmsAuth.AdminRoleId)
            return BadRequest(new { message = CannotDeleteAdmin });

        var deleted = await repository.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }
}

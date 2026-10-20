using CMS.API.Data;
using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/app-users")]
public class AppUsersController(IAppUserRepository repository, ISysConfigRepository sysConfig) : ControllerBase
{
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

        var passwordHash = await DefaultPassword.ReadHashAsync(sysConfig);
        if (passwordHash is null)
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = DefaultPassword.MissingMessage });

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

    // Password reset lives in AuthController (POST /api/auth/reset-password, Admin only).

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await repository.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }
}

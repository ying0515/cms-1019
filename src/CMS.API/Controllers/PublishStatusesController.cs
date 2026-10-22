using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/publish-statuses")]
public class PublishStatusesController(IPublishStatusRepository repository) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<PublishStatus>>> GetAll()
        => Ok(await repository.GetAllAsync());

    [HttpPost("query")]
    public async Task<ActionResult<IEnumerable<PublishStatus>>> Query([FromBody] PublishStatusQuery query)
        => Ok(await repository.QueryAsync(query));

    // pkid is tinyint, so ids outside 0–255 cannot exist
    [HttpGet("{id:int}")]
    public async Task<ActionResult<PublishStatus>> GetById(int id)
    {
        if (id is < byte.MinValue or > byte.MaxValue) return NotFound();
        var item = await repository.GetByIdAsync((byte)id);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<PublishStatus>> Create([FromBody] PublishStatusRequest request)
    {
        request.Description = request.Description.Trim();
        if (await repository.ExistsAsync(request.Pkid))
            return Conflict(new { message = $"主代碼 {request.Pkid} 已存在" });

        await repository.CreateAsync(request);
        var created = await repository.GetByIdAsync(request.Pkid);
        return CreatedAtAction(nameof(GetById), new { id = request.Pkid }, created);
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] PublishStatusRequest request)
    {
        request.Description = request.Description.Trim();
        var updated = await repository.UpdateAsync(request);
        return updated ? NoContent() : NotFound();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (id is < byte.MinValue or > byte.MaxValue) return NotFound();
        try
        {
            var deleted = await repository.DeleteAsync((byte)id);
            return deleted ? NoContent() : NotFound();
        }
        catch (ReferenceConflictException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }
}

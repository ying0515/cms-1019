using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/partners")]
public class PartnersController(IPartnerRepository repository) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Partner>>> GetAll()
        => Ok(await repository.GetAllAsync());

    [HttpPost("query")]
    public async Task<ActionResult<IEnumerable<Partner>>> Query([FromBody] PartnerQuery query)
        => Ok(await repository.QueryAsync(query));

    // pkid is smallint, so ids outside its range cannot exist
    [HttpGet("{id:int}")]
    public async Task<ActionResult<Partner>> GetById(int id)
    {
        if (id is < short.MinValue or > short.MaxValue) return NotFound();
        var item = await repository.GetByIdAsync((short)id);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<Partner>> Create([FromBody] PartnerRequest request)
    {
        Normalize(request);
        var pkid = await repository.CreateAsync(request);
        var created = await repository.GetByIdAsync(pkid);
        return CreatedAtAction(nameof(GetById), new { id = pkid }, created);
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] PartnerRequest request)
    {
        Normalize(request);
        var updated = await repository.UpdateAsync(request);
        return updated ? NoContent() : NotFound();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (id is < short.MinValue or > short.MaxValue) return NotFound();
        try
        {
            var deleted = await repository.DeleteAsync((short)id);
            return deleted ? NoContent() : NotFound();
        }
        catch (ReferenceConflictException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    private static void Normalize(PartnerRequest request)
    {
        request.Name = request.Name.Trim();
        request.AppKey = request.AppKey.Trim();
        request.NameOnPartnerMenu = request.NameOnPartnerMenu.Trim();
        request.NameOnCourseDetailPage = request.NameOnCourseDetailPage.Trim();
        request.ImageFilename = string.IsNullOrWhiteSpace(request.ImageFilename) ? null : request.ImageFilename.Trim();
    }
}

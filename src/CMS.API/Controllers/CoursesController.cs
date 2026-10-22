using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/courses")]
public class CoursesController(ICourseRepository repository) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Course>>> GetAll()
        => Ok(await repository.GetAllAsync());

    [HttpPost("query")]
    public async Task<ActionResult<IEnumerable<Course>>> Query([FromBody] CourseQuery query)
        => Ok(await repository.QueryAsync(query));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<Course>> GetById(int id)
    {
        var item = await repository.GetByIdAsync(id);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<Course>> Create([FromBody] CourseRequest request)
    {
        Normalize(request);
        try
        {
            var pkid = await repository.CreateAsync(request);
            var created = await repository.GetByIdAsync(pkid);
            return CreatedAtAction(nameof(GetById), new { id = pkid }, created);
        }
        catch (InvalidReferenceException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] CourseRequest request)
    {
        Normalize(request);
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

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        try
        {
            var deleted = await repository.DeleteAsync(id);
            return deleted ? NoContent() : NotFound();
        }
        catch (ReferenceConflictException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    private static void Normalize(CourseRequest request)
    {
        request.Title = request.Title.Trim();
        request.CourseId = request.CourseId.Trim();
        request.ProdCourseId = request.ProdCourseId.Trim();
        request.FriendlyUrl = request.FriendlyUrl.Trim();
        request.OfficialTitle = NullIfBlank(request.OfficialTitle);
        request.Material = NullIfBlank(request.Material);
        request.Objective = NullIfBlank(request.Objective);
        request.Target = NullIfBlank(request.Target);
        request.Prerequisites = NullIfBlank(request.Prerequisites);
        request.Outline = NullIfBlank(request.Outline);
        request.TowardCertOrExam = NullIfBlank(request.TowardCertOrExam);
        request.Note = NullIfBlank(request.Note);
        request.OtherInfo = NullIfBlank(request.OtherInfo);
        if (request.CourseGroupPkid is <= 0) request.CourseGroupPkid = null;
    }

    private static string? NullIfBlank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}

using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/lookups")]
public class LookupsController(ILookupRepository repository) : ControllerBase
{
    [HttpGet("app-users")]
    public async Task<ActionResult<IEnumerable<AppUserLookup>>> GetAppUsers()
        => Ok(await repository.GetAppUsersAsync());

    [HttpGet("publish-statuses")]
    public async Task<ActionResult<IEnumerable<PublishStatusLookup>>> GetPublishStatuses()
        => Ok(await repository.GetPublishStatusesAsync());

    [HttpGet("partners")]
    public async Task<ActionResult<IEnumerable<PartnerLookup>>> GetPartners()
        => Ok(await repository.GetPartnersAsync());

    [HttpGet("course-groups")]
    public async Task<ActionResult<IEnumerable<CourseGroupLookup>>> GetCourseGroups()
        => Ok(await repository.GetCourseGroupsAsync());

    [HttpGet("certifications")]
    public async Task<ActionResult<IEnumerable<CertificationLookup>>> GetCertifications()
        => Ok(await repository.GetCertificationsAsync());

    [HttpGet("job-categories")]
    public async Task<ActionResult<IEnumerable<JobCategoryLookup>>> GetJobCategories()
        => Ok(await repository.GetJobCategoriesAsync());
}

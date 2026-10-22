using CMS.API.Auth;
using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/lookups")]
public class LookupsController(ILookupRepository repository) : ControllerBase
{
    // Used only by the user / role management pages
    [Authorize(Policy = CmsAuth.AdminPolicy)]
    [HttpGet("app-users")]
    public async Task<ActionResult<IEnumerable<AppUserLookup>>> GetAppUsers()
        => Ok(await repository.GetAppUsersAsync());

    [Authorize(Policy = CmsAuth.AdminPolicy)]
    [HttpGet("app-roles")]
    public async Task<ActionResult<IEnumerable<AppRoleLookup>>> GetAppRoles()
        => Ok(await repository.GetAppRolesAsync());

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

    [HttpGet("training-centers")]
    public async Task<ActionResult<IEnumerable<TrainingCenterLookup>>> GetTrainingCenters()
        => Ok(await repository.GetTrainingCentersAsync());

    /// <summary>PromoCode autocomplete: up to <paramref name="take"/> matches (1–100).</summary>
    [HttpGet("promotions")]
    public async Task<ActionResult<IEnumerable<PromotionLookup>>> GetPromotions(
        [FromQuery] string? keyword, [FromQuery] int take = 20)
        => Ok(await repository.GetPromotionsAsync(keyword?.Trim(), Math.Clamp(take, 1, 100)));
}

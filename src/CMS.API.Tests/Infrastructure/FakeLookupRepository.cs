using CMS.API.Models;
using CMS.API.Repositories;

namespace CMS.API.Tests.Infrastructure;

/// <summary>ILookupRepository backed by the other fakes, so lookup endpoints reflect their state.</summary>
public class FakeLookupRepository(FakeAppRoleRepository appRoles, FakePublishStatusRepository publishStatuses,
    FakePartnerRepository partners, FakeCourseGroupRepository courseGroups, FakeCourseRepository courses,
    FakeFeaturedPromoItemRepository featuredPromoItems, FakeAgentTokenUsageRepository agentTokenUsage)
    : ILookupRepository
{
    public Task<IEnumerable<string>> GetAgentTokenProjectsAsync()
        => Task.FromResult<IEnumerable<string>>(agentTokenUsage.Rows
            .Select(r => r.Project).Distinct().Order(StringComparer.Ordinal).ToList());

    public Task<IEnumerable<string>> GetAgentTokenModelsAsync()
        => Task.FromResult<IEnumerable<string>>(agentTokenUsage.Rows
            .Select(r => r.Model).Distinct().Order(StringComparer.Ordinal).ToList());

    public Task<IEnumerable<TrainingCenterLookup>> GetTrainingCentersAsync()
        => Task.FromResult<IEnumerable<TrainingCenterLookup>>(featuredPromoItems.TrainingCenters
            .OrderBy(t => t.DisplayOrder)
            .ThenBy(t => t.Pkid)
            .Select(t => new TrainingCenterLookup { Pkid = t.Pkid, Name = t.Name })
            .ToList());

    // Mirrors LIKE '%k%' (literal, case-insensitive), prefix matches first, then newest pkid
    public Task<IEnumerable<PromotionLookup>> GetPromotionsAsync(string? keyword, int take)
        => Task.FromResult<IEnumerable<PromotionLookup>>(featuredPromoItems.Promotions
            .Where(p => string.IsNullOrEmpty(keyword) || p.PromoCode.Contains(keyword, StringComparison.OrdinalIgnoreCase))
            .OrderBy(p => !string.IsNullOrEmpty(keyword) && p.PromoCode.StartsWith(keyword, StringComparison.OrdinalIgnoreCase) ? 0 : 1)
            .ThenByDescending(p => p.Pkid)
            .Take(take)
            .ToList());

    public Task<IEnumerable<AppUserLookup>> GetAppUsersAsync()
        => Task.FromResult<IEnumerable<AppUserLookup>>(appRoles.Users.Values.OrderBy(u => u.UserName).ToList());

    public Task<IEnumerable<AppRoleLookup>> GetAppRolesAsync()
        => Task.FromResult<IEnumerable<AppRoleLookup>>(appRoles.Roles.OrderBy(r => r.RoleId).ToList());

    public Task<IEnumerable<PublishStatusLookup>> GetPublishStatusesAsync()
        => Task.FromResult<IEnumerable<PublishStatusLookup>>(publishStatuses.Items
            .OrderBy(s => s.Pkid)
            .Select(s => new PublishStatusLookup { Pkid = s.Pkid, Description = s.Description })
            .ToList());

    public Task<IEnumerable<PartnerLookup>> GetPartnersAsync()
        => Task.FromResult<IEnumerable<PartnerLookup>>(partners.Items
            .OrderBy(p => p.DisplayOrder)
            .ThenBy(p => p.Pkid)
            .Select(p => new PartnerLookup { Pkid = p.Pkid, Name = p.Name })
            .ToList());

    public Task<IEnumerable<CourseGroupLookup>> GetCourseGroupsAsync()
        => Task.FromResult<IEnumerable<CourseGroupLookup>>(courseGroups.Items
            .OrderBy(g => g.Pkid)
            .Select(g => new CourseGroupLookup { Pkid = g.Pkid, Description = g.Description })
            .ToList());

    public Task<IEnumerable<CertificationLookup>> GetCertificationsAsync()
    {
        var partnerOrder = partners.Items.ToDictionary(p => p.Pkid, p => p.DisplayOrder);
        return Task.FromResult<IEnumerable<CertificationLookup>>(courses.CertificationLookups()
            .OrderBy(c => partnerOrder.GetValueOrDefault(c.PartnerPkid))
            .ThenBy(c => c.PartnerPkid)
            .ThenBy(c => c.Title)
            .ToList());
    }

    public Task<IEnumerable<JobCategoryLookup>> GetJobCategoriesAsync()
        => Task.FromResult<IEnumerable<JobCategoryLookup>>(courses.JobCategories.OrderBy(j => j.Pkid).ToList());
}

using CMS.API.Models;

namespace CMS.API.Repositories;

public interface ILookupRepository
{
    Task<IEnumerable<AppUserLookup>> GetAppUsersAsync();
    Task<IEnumerable<AppRoleLookup>> GetAppRolesAsync();
    Task<IEnumerable<PublishStatusLookup>> GetPublishStatusesAsync();
    Task<IEnumerable<PartnerLookup>> GetPartnersAsync();
    Task<IEnumerable<CourseGroupLookup>> GetCourseGroupsAsync();
    Task<IEnumerable<CertificationLookup>> GetCertificationsAsync();
    Task<IEnumerable<JobCategoryLookup>> GetJobCategoriesAsync();
    Task<IEnumerable<TrainingCenterLookup>> GetTrainingCentersAsync();
    /// <summary>PromoCode contains <paramref name="keyword"/> (all when blank); prefix matches first, then newest.</summary>
    Task<IEnumerable<PromotionLookup>> GetPromotionsAsync(string? keyword, int take);
    /// <summary>Distinct AgentTokenUsage.Project values, ascending.</summary>
    Task<IEnumerable<string>> GetAgentTokenProjectsAsync();
    /// <summary>Distinct AgentTokenUsage.Model values, ascending.</summary>
    Task<IEnumerable<string>> GetAgentTokenModelsAsync();
}

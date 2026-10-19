using CMS.API.Models;

namespace CMS.API.Repositories;

public interface ILookupRepository
{
    Task<IEnumerable<AppUserLookup>> GetAppUsersAsync();
    Task<IEnumerable<PublishStatusLookup>> GetPublishStatusesAsync();
    Task<IEnumerable<PartnerLookup>> GetPartnersAsync();
    Task<IEnumerable<CourseGroupLookup>> GetCourseGroupsAsync();
    Task<IEnumerable<CertificationLookup>> GetCertificationsAsync();
    Task<IEnumerable<JobCategoryLookup>> GetJobCategoriesAsync();
}

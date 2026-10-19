using CMS.API.Models;

namespace CMS.API.Repositories;

public interface IPublishStatusRepository
{
    Task<IEnumerable<PublishStatus>> GetAllAsync();
    Task<IEnumerable<PublishStatus>> QueryAsync(PublishStatusQuery query);
    Task<PublishStatus?> GetByIdAsync(byte pkid);
    Task<bool> ExistsAsync(byte pkid);
    Task CreateAsync(PublishStatusRequest request);
    Task<bool> UpdateAsync(PublishStatusRequest request);
    /// <exception cref="ReferenceConflictException">The status is referenced by Course / Promotion2.</exception>
    Task<bool> DeleteAsync(byte pkid);
}

using CMS.API.Models;

namespace CMS.API.Repositories;

public interface ICourseGroupRepository
{
    Task<IEnumerable<CourseGroup>> GetAllAsync();
    Task<IEnumerable<CourseGroup>> QueryAsync(CourseGroupQuery query);
    Task<CourseGroup?> GetByIdAsync(short pkid);
    /// <returns>The new IDENTITY pkid.</returns>
    Task<short> CreateAsync(CourseGroupRequest request);
    Task<bool> UpdateAsync(CourseGroupRequest request);
    /// <exception cref="ReferenceConflictException">The group is referenced by Course / PartnerCourseGroup.</exception>
    Task<bool> DeleteAsync(short pkid);
}

using CMS.API.Models;

namespace CMS.API.Repositories;

public interface ICourseRepository
{
    Task<IEnumerable<Course>> GetAllAsync();
    Task<IEnumerable<Course>> QueryAsync(CourseQuery query);
    /// <summary>Includes the n-n Certifications and JobCategories.</summary>
    Task<Course?> GetByIdAsync(int pkid);
    /// <returns>The new IDENTITY pkid.</returns>
    /// <exception cref="InvalidReferenceException">A referenced Partner / CourseGroup / PublishStatus / Certification / JobCategory does not exist.</exception>
    Task<int> CreateAsync(CourseRequest request);
    /// <exception cref="InvalidReferenceException">A referenced Partner / CourseGroup / PublishStatus / Certification / JobCategory does not exist.</exception>
    Task<bool> UpdateAsync(CourseRequest request);
    /// <exception cref="ReferenceConflictException">The course is referenced by CourseFAQ / CourseRelatedLink / HotCourse.</exception>
    Task<bool> DeleteAsync(int pkid);
}

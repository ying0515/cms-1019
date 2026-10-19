using CMS.API.Models;

namespace CMS.API.Repositories;

public interface IPartnerRepository
{
    Task<IEnumerable<Partner>> GetAllAsync();
    Task<IEnumerable<Partner>> QueryAsync(PartnerQuery query);
    Task<Partner?> GetByIdAsync(short pkid);
    /// <returns>The new IDENTITY pkid.</returns>
    Task<short> CreateAsync(PartnerRequest request);
    Task<bool> UpdateAsync(PartnerRequest request);
    /// <exception cref="ReferenceConflictException">The partner is referenced by Course / Certification / PartnerCourseGroup / Promotion2.</exception>
    Task<bool> DeleteAsync(short pkid);
}

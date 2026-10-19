using CMS.API.Models;

namespace CMS.API.Repositories;

public interface IAppUserRepository
{
    Task<IEnumerable<AppUser>> GetAllAsync();
    Task<IEnumerable<AppUser>> QueryAsync(AppUserQuery query);
    Task<AppUser?> GetByIdAsync(int pkid);
    Task<bool> UserIdExistsAsync(string userId);
    Task<int> CreateAsync(AppUserRequest request, string passwordHash);
    /// <summary>Updates UserName / IsActive / roles; never touches UserId or PasswordHash.</summary>
    Task<bool> UpdateAsync(AppUserRequest request);
    Task<bool> ResetPasswordAsync(int pkid, string passwordHash);
    Task<bool> DeleteAsync(int pkid);
}

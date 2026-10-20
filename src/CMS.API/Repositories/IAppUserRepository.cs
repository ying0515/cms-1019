using CMS.API.Models;

namespace CMS.API.Repositories;

public interface IAppUserRepository
{
    Task<IEnumerable<AppUser>> GetAllAsync();
    Task<IEnumerable<AppUser>> QueryAsync(AppUserQuery query);
    Task<AppUser?> GetByIdAsync(int pkid);
    Task<bool> UserIdExistsAsync(string userId);
    /// <summary>Login lookup by exact (case-sensitive) UserId, with PasswordHash and RoleIds; null if not found. Backend-only.</summary>
    Task<AppUserCredential?> GetCredentialAsync(string userId);
    Task<int> CreateAsync(AppUserRequest request, string passwordHash);
    /// <summary>Updates UserName / IsActive / roles; never touches UserId or PasswordHash.</summary>
    Task<bool> UpdateAsync(AppUserRequest request);
    /// <summary>Changes only UserName of this UserId (from the JWT, for My Profile); false if not found.</summary>
    Task<bool> UpdateUserNameAsync(string userId, string userName);
    /// <summary>Sets PasswordHash and PasswordUpdatedTime (UTC) of this UserId (change-password, Admin reset); false if not found.</summary>
    Task<bool> SetPasswordAsync(string userId, string passwordHash, DateTime updatedUtc);
    Task<bool> DeleteAsync(int pkid);
}

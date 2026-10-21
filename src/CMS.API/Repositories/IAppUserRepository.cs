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
    /// <summary>Sets a default password: also sets MustChangePassword and PasswordUpdatedTime.</summary>
    Task<bool> ResetPasswordAsync(int pkid, string passwordHash);
    Task<bool> DeleteAsync(int pkid);

    // Login only — AppUserCredential carries PasswordHash and never leaves the backend.
    Task<AppUserCredential?> GetCredentialAsync(string userId);
    Task<AppUserCredential?> GetCredentialAsync(int pkid);
    /// <summary>The user's own new password: clears MustChangePassword, sets PasswordUpdatedTime.</summary>
    Task<bool> ChangePasswordAsync(int pkid, string passwordHash);
    /// <summary>Same password in a newer hash format; nothing else changes, so sessions stay valid.</summary>
    Task<bool> RehashPasswordAsync(int pkid, string passwordHash);
}

using CMS.API.Models;

namespace CMS.API.Repositories;

public interface IAppRoleRepository
{
    Task<IEnumerable<AppRole>> GetAllAsync();
    Task<IEnumerable<AppRole>> QueryAsync(AppRoleQuery query);
    Task<AppRole?> GetByIdAsync(int pkid);
    Task<bool> RoleIdExistsAsync(string roleId);
    Task<int> CreateAsync(AppRoleRequest request);
    Task<bool> UpdateAsync(AppRoleRequest request);
    Task<bool> DeleteAsync(int pkid);
}

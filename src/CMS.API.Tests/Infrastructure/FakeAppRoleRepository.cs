using CMS.API.Models;
using CMS.API.Repositories;

namespace CMS.API.Tests.Infrastructure;

/// <summary>In-memory IAppRoleRepository so endpoint tests run without SQL Server.</summary>
public class FakeAppRoleRepository : IAppRoleRepository
{
    private readonly object _lock = new();
    private readonly List<AppRoleRequest> _roles = [];
    private readonly Dictionary<string, AppUserLookup> _users;
    private int _nextPkid = 1;

    public FakeAppRoleRepository()
    {
        _users = new[]
        {
            new AppUserLookup { UserId = "helen", UserName = "helen", IsActive = true },
            new AppUserLookup { UserId = "jenny", UserName = "Jenny_Tsao", IsActive = true },
            new AppUserLookup { UserId = "miles", UserName = "Miles Sun", IsActive = true },
        }.ToDictionary(u => u.UserId);

        Seed(new AppRoleRequest { RoleId = "Admin", RoleName = "Administrator", PermissionLevel = 1, Description = "系統管理員", UserIds = ["helen", "jenny"] });
        Seed(new AppRoleRequest { RoleId = "User", RoleName = "User", PermissionLevel = 100, Description = "一般使用者", UserIds = ["miles"] });
    }

    public IReadOnlyDictionary<string, AppUserLookup> Users => _users;

    private void Seed(AppRoleRequest request)
    {
        request.Pkid = _nextPkid++;
        _roles.Add(request);
    }

    private AppRole ToModel(AppRoleRequest r, bool withUsers) => new()
    {
        Pkid = r.Pkid,
        RoleId = r.RoleId,
        RoleName = r.RoleName,
        PermissionLevel = r.PermissionLevel,
        Description = r.Description,
        UserCount = r.UserIds.Count,
        Users = withUsers ? r.UserIds.Where(_users.ContainsKey).Select(id => _users[id]).ToList() : [],
    };

    public Task<IEnumerable<AppRole>> GetAllAsync()
    {
        lock (_lock)
            return Task.FromResult<IEnumerable<AppRole>>(_roles.OrderBy(r => r.RoleId).Select(r => ToModel(r, false)).ToList());
    }

    public Task<IEnumerable<AppRole>> QueryAsync(AppRoleQuery query)
    {
        lock (_lock)
        {
            IEnumerable<AppRoleRequest> q = _roles;
            if (!string.IsNullOrWhiteSpace(query.Keyword))
            {
                var k = query.Keyword.Trim();
                q = q.Where(r => r.RoleId.Contains(k, StringComparison.OrdinalIgnoreCase)
                    || r.RoleName.Contains(k, StringComparison.OrdinalIgnoreCase)
                    || (r.Description?.Contains(k, StringComparison.OrdinalIgnoreCase) ?? false));
            }
            if (query.PermissionLevelFrom.HasValue) q = q.Where(r => r.PermissionLevel >= query.PermissionLevelFrom);
            if (query.PermissionLevelTo.HasValue) q = q.Where(r => r.PermissionLevel <= query.PermissionLevelTo);
            if (!string.IsNullOrWhiteSpace(query.UserId)) q = q.Where(r => r.UserIds.Contains(query.UserId));
            return Task.FromResult<IEnumerable<AppRole>>(q.OrderBy(r => r.RoleId).Select(r => ToModel(r, false)).ToList());
        }
    }

    public Task<AppRole?> GetByIdAsync(int pkid)
    {
        lock (_lock)
        {
            var r = _roles.FirstOrDefault(x => x.Pkid == pkid);
            return Task.FromResult(r is null ? null : ToModel(r, true));
        }
    }

    public Task<bool> RoleIdExistsAsync(string roleId)
    {
        lock (_lock)
            return Task.FromResult(_roles.Any(r => string.Equals(r.RoleId, roleId, StringComparison.OrdinalIgnoreCase)));
    }

    public Task<int> CreateAsync(AppRoleRequest request)
    {
        lock (_lock)
        {
            var copy = Clone(request);
            copy.Pkid = _nextPkid++;
            _roles.Add(copy);
            return Task.FromResult(copy.Pkid);
        }
    }

    public Task<bool> UpdateAsync(AppRoleRequest request)
    {
        lock (_lock)
        {
            var existing = _roles.FirstOrDefault(x => x.Pkid == request.Pkid);
            if (existing is null) return Task.FromResult(false);
            existing.RoleName = request.RoleName;
            existing.PermissionLevel = request.PermissionLevel;
            existing.Description = request.Description;
            existing.UserIds = request.UserIds.Distinct().ToList();
            return Task.FromResult(true);
        }
    }

    public Task<bool> DeleteAsync(int pkid)
    {
        lock (_lock)
            return Task.FromResult(_roles.RemoveAll(x => x.Pkid == pkid) > 0);
    }

    private static AppRoleRequest Clone(AppRoleRequest r) => new()
    {
        Pkid = r.Pkid,
        RoleId = r.RoleId,
        RoleName = r.RoleName,
        PermissionLevel = r.PermissionLevel,
        Description = r.Description,
        UserIds = r.UserIds.Distinct().ToList(),
    };
}

using CMS.API.Models;
using CMS.API.Repositories;

namespace CMS.API.Tests.Infrastructure;

/// <summary>In-memory IAppUserRepository so endpoint tests run without SQL Server.</summary>
public class FakeAppUserRepository : IAppUserRepository
{
    private readonly object _lock = new();
    private readonly List<Row> _users = [];
    private readonly FakeAppRoleRepository _appRoles;
    private int _nextPkid = 1;

    private sealed class Row
    {
        public int Pkid { get; set; }
        public string UserId { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public string PasswordHash { get; set; } = string.Empty;
        public DateTime? PasswordUpdatedTime { get; set; }
        public List<string> RoleIds { get; set; } = [];
    }

    public FakeAppUserRepository(FakeAppRoleRepository appRoles)
    {
        _appRoles = appRoles;
        Seed("helen", "helen", true, ["Admin"]);
        Seed("jenny", "Jenny_Tsao", true, ["Admin"]);
        Seed("miles", "Miles Sun", false, ["User"]);
    }

    private void Seed(string userId, string userName, bool isActive, List<string> roleIds)
        => _users.Add(new Row
        {
            Pkid = _nextPkid++,
            UserId = userId,
            UserName = userName,
            IsActive = isActive,
            PasswordHash = "seed-hash",
            RoleIds = roleIds,
        });

    /// <summary>Stored PasswordHash by pkid (null if missing) — what the API never exposes.</summary>
    public string? PasswordHashOf(int pkid)
    {
        lock (_lock) return _users.FirstOrDefault(u => u.Pkid == pkid)?.PasswordHash;
    }

    private AppUser ToModel(Row r, bool withRoles)
    {
        var roles = _appRoles.Roles.ToDictionary(x => x.RoleId);
        return new AppUser
        {
            Pkid = r.Pkid,
            UserId = r.UserId,
            UserName = r.UserName,
            IsActive = r.IsActive,
            PasswordUpdatedTime = r.PasswordUpdatedTime,
            RoleCount = r.RoleIds.Count,
            Roles = withRoles ? r.RoleIds.Where(roles.ContainsKey).Select(id => roles[id]).OrderBy(x => x.RoleId).ToList() : [],
        };
    }

    public Task<IEnumerable<AppUser>> GetAllAsync()
    {
        lock (_lock)
            return Task.FromResult<IEnumerable<AppUser>>(_users.OrderBy(u => u.UserId).Select(u => ToModel(u, false)).ToList());
    }

    public Task<IEnumerable<AppUser>> QueryAsync(AppUserQuery query)
    {
        lock (_lock)
        {
            IEnumerable<Row> q = _users;
            if (!string.IsNullOrWhiteSpace(query.Keyword))
            {
                var k = query.Keyword.Trim();
                q = q.Where(u => u.UserId.Contains(k, StringComparison.OrdinalIgnoreCase)
                    || u.UserName.Contains(k, StringComparison.OrdinalIgnoreCase));
            }
            if (query.IsActive.HasValue) q = q.Where(u => u.IsActive == query.IsActive);
            if (!string.IsNullOrWhiteSpace(query.RoleId)) q = q.Where(u => u.RoleIds.Contains(query.RoleId));
            return Task.FromResult<IEnumerable<AppUser>>(q.OrderBy(u => u.UserId).Select(u => ToModel(u, false)).ToList());
        }
    }

    public Task<AppUser?> GetByIdAsync(int pkid)
    {
        lock (_lock)
        {
            var r = _users.FirstOrDefault(x => x.Pkid == pkid);
            return Task.FromResult(r is null ? null : ToModel(r, true));
        }
    }

    public Task<bool> UserIdExistsAsync(string userId)
    {
        lock (_lock)
            return Task.FromResult(_users.Any(u => string.Equals(u.UserId, userId, StringComparison.OrdinalIgnoreCase)));
    }

    public Task<int> CreateAsync(AppUserRequest request, string passwordHash)
    {
        lock (_lock)
        {
            var roleIds = ValidRoleIds(request.RoleIds);
            var row = new Row
            {
                Pkid = _nextPkid++,
                UserId = request.UserId,
                UserName = request.UserName,
                IsActive = request.IsActive,
                PasswordHash = passwordHash,
                PasswordUpdatedTime = DateTime.UtcNow,
                RoleIds = roleIds,
            };
            _users.Add(row);
            return Task.FromResult(row.Pkid);
        }
    }

    public Task<bool> UpdateAsync(AppUserRequest request)
    {
        lock (_lock)
        {
            var existing = _users.FirstOrDefault(x => x.Pkid == request.Pkid);
            if (existing is null) return Task.FromResult(false);
            var roleIds = ValidRoleIds(request.RoleIds);
            existing.UserName = request.UserName;
            existing.IsActive = request.IsActive;
            existing.RoleIds = roleIds;
            return Task.FromResult(true);
        }
    }

    public Task<bool> ResetPasswordAsync(int pkid, string passwordHash)
    {
        lock (_lock)
        {
            var existing = _users.FirstOrDefault(x => x.Pkid == pkid);
            if (existing is null) return Task.FromResult(false);
            existing.PasswordHash = passwordHash;
            existing.PasswordUpdatedTime = DateTime.UtcNow;
            return Task.FromResult(true);
        }
    }

    public Task<bool> DeleteAsync(int pkid)
    {
        lock (_lock)
            return Task.FromResult(_users.RemoveAll(x => x.Pkid == pkid) > 0);
    }

    // Mirrors the FK_AppUserRole_AppRole violation (SQL 547).
    private List<string> ValidRoleIds(IEnumerable<string> roleIds)
    {
        var known = _appRoles.Roles.Select(r => r.RoleId).ToHashSet();
        var ids = roleIds.Where(r => !string.IsNullOrWhiteSpace(r)).Distinct().ToList();
        if (ids.Any(id => !known.Contains(id)))
            throw new InvalidReferenceException("指定的角色不存在");
        return ids;
    }
}

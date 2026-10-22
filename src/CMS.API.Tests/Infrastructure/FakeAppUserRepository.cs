using CMS.API.Data;
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
        public bool MustChangePassword { get; set; }
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

    public bool? MustChangePasswordOf(int pkid)
    {
        lock (_lock) return _users.FirstOrDefault(u => u.Pkid == pkid)?.MustChangePassword;
    }

    /// <summary>Gives a seeded user a known password, as stored by the API (PBKDF2) unless a hash is passed.</summary>
    public void SetPassword(string userId, string password, bool mustChangePassword = false, string? hash = null)
    {
        lock (_lock)
        {
            var row = _users.Single(u => u.UserId == userId);
            row.PasswordHash = hash ?? PasswordHasher.Hash(password);
            row.PasswordUpdatedTime = DateTime.UtcNow;
            row.MustChangePassword = mustChangePassword;
        }
    }

    public void SetActive(string userId, bool isActive)
    {
        lock (_lock) _users.Single(u => u.UserId == userId).IsActive = isActive;
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
                MustChangePassword = true,
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
            existing.MustChangePassword = true;
            return Task.FromResult(true);
        }
    }

    public Task<bool> DeleteAsync(int pkid)
    {
        lock (_lock)
            return Task.FromResult(_users.RemoveAll(x => x.Pkid == pkid) > 0);
    }

    public Task<AppUserCredential?> GetCredentialAsync(string userId)
    {
        lock (_lock)
            return Task.FromResult(ToCredential(_users.FirstOrDefault(u =>
                string.Equals(u.UserId, userId, StringComparison.OrdinalIgnoreCase))));
    }

    public Task<AppUserCredential?> GetCredentialAsync(int pkid)
    {
        lock (_lock) return Task.FromResult(ToCredential(_users.FirstOrDefault(u => u.Pkid == pkid)));
    }

    public Task<bool> ChangePasswordAsync(int pkid, string passwordHash)
    {
        lock (_lock)
        {
            var existing = _users.FirstOrDefault(x => x.Pkid == pkid);
            if (existing is null) return Task.FromResult(false);
            existing.PasswordHash = passwordHash;
            // Always a new stamp, even within the same clock tick
            var now = DateTime.UtcNow;
            existing.PasswordUpdatedTime = existing.PasswordUpdatedTime is { } previous && previous >= now
                ? previous.AddMilliseconds(10)
                : now;
            existing.MustChangePassword = false;
            return Task.FromResult(true);
        }
    }

    public Task<bool> RehashPasswordAsync(int pkid, string passwordHash)
    {
        lock (_lock)
        {
            var existing = _users.FirstOrDefault(x => x.Pkid == pkid);
            if (existing is null) return Task.FromResult(false);
            existing.PasswordHash = passwordHash;
            return Task.FromResult(true);
        }
    }

    private static AppUserCredential? ToCredential(Row? r)
        => r is null ? null : new AppUserCredential
        {
            Pkid = r.Pkid,
            UserId = r.UserId,
            UserName = r.UserName,
            IsActive = r.IsActive,
            PasswordHash = r.PasswordHash,
            PasswordUpdatedTime = r.PasswordUpdatedTime,
            MustChangePassword = r.MustChangePassword,
        };

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

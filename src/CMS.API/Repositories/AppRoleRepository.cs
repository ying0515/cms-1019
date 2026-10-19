using System.Data;
using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public class AppRoleRepository(IDbConnectionFactory db) : IAppRoleRepository
{
    private const string SelectSql = """
        SELECT r.pkid, r.RoleId, r.RoleName, r.PermissionLevel, r.Description,
               (SELECT COUNT(*) FROM AppUserRole ur WHERE ur.RoleId = r.RoleId) AS UserCount
        FROM AppRole r
        """;

    private const string OrderBySql = " ORDER BY r.RoleId ASC";

    public async Task<IEnumerable<AppRole>> GetAllAsync()
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.QueryAsync<AppRole>(SelectSql + OrderBySql);
    }

    public async Task<IEnumerable<AppRole>> QueryAsync(AppRoleQuery query)
    {
        var where = new List<string>();
        var p = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            where.Add("(r.RoleId LIKE @Keyword OR r.RoleName LIKE @Keyword OR r.Description LIKE @Keyword)");
            p.Add("Keyword", $"%{query.Keyword.Trim()}%");
        }
        if (query.PermissionLevelFrom.HasValue)
        {
            where.Add("r.PermissionLevel >= @PermissionLevelFrom");
            p.Add("PermissionLevelFrom", query.PermissionLevelFrom);
        }
        if (query.PermissionLevelTo.HasValue)
        {
            where.Add("r.PermissionLevel <= @PermissionLevelTo");
            p.Add("PermissionLevelTo", query.PermissionLevelTo);
        }
        if (!string.IsNullOrWhiteSpace(query.UserId))
        {
            where.Add("EXISTS (SELECT 1 FROM AppUserRole ur WHERE ur.RoleId = r.RoleId AND ur.UserId = @UserId)");
            p.Add("UserId", query.UserId);
        }

        var sql = SelectSql
            + (where.Count > 0 ? " WHERE " + string.Join(" AND ", where) : "")
            + OrderBySql;

        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.QueryAsync<AppRole>(sql, p);
    }

    public async Task<AppRole?> GetByIdAsync(int pkid)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        var role = await conn.QuerySingleOrDefaultAsync<AppRole>(SelectSql + " WHERE r.pkid = @pkid", new { pkid });
        if (role is null) return null;

        // n-n: separate query on same connection
        role.Users = (await conn.QueryAsync<AppUserLookup>("""
            SELECT u.UserId, u.UserName, u.IsActive
            FROM AppUserRole ur
            INNER JOIN AppUser u ON u.UserId = ur.UserId
            WHERE ur.RoleId = @RoleId
            ORDER BY u.UserName ASC
            """, new { role.RoleId })).ToList();

        return role;
    }

    public async Task<bool> RoleIdExistsAsync(string roleId)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM AppRole WHERE RoleId = @roleId", new { roleId }) > 0;
    }

    public async Task<int> CreateAsync(AppRoleRequest request)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        using var tx = conn.BeginTransaction();

        var pkid = await conn.ExecuteScalarAsync<int>("""
            INSERT INTO AppRole (RoleId, RoleName, PermissionLevel, Description)
            VALUES (@RoleId, @RoleName, @PermissionLevel, @Description);
            SELECT CAST(SCOPE_IDENTITY() AS int);
            """, request, tx);

        await SyncUsersAsync(conn, tx, request.RoleId, request.UserIds);
        tx.Commit();
        return pkid;
    }

    public async Task<bool> UpdateAsync(AppRoleRequest request)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        using var tx = conn.BeginTransaction();

        // RoleId is the table PK (referenced by AppUserRole), so it is not updatable.
        var roleId = await conn.ExecuteScalarAsync<string?>(
            "SELECT RoleId FROM AppRole WHERE pkid = @Pkid", new { request.Pkid }, tx);
        if (roleId is null) return false;

        await conn.ExecuteAsync("""
            UPDATE AppRole
            SET RoleName = @RoleName, PermissionLevel = @PermissionLevel, Description = @Description
            WHERE pkid = @Pkid
            """, request, tx);

        await SyncUsersAsync(conn, tx, roleId, request.UserIds);
        tx.Commit();
        return true;
    }

    public async Task<bool> DeleteAsync(int pkid)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        using var tx = conn.BeginTransaction();

        var roleId = await conn.ExecuteScalarAsync<string?>(
            "SELECT RoleId FROM AppRole WHERE pkid = @pkid", new { pkid }, tx);
        if (roleId is null) return false;

        await conn.ExecuteAsync("DELETE FROM AppUserRole WHERE RoleId = @roleId", new { roleId }, tx);
        await conn.ExecuteAsync("DELETE FROM AppRole WHERE pkid = @pkid", new { pkid }, tx);
        tx.Commit();
        return true;
    }

    // n-n: delete-then-reinsert
    private static async Task SyncUsersAsync(IDbConnection conn, IDbTransaction tx, string roleId, IEnumerable<string> userIds)
    {
        await conn.ExecuteAsync("DELETE FROM AppUserRole WHERE RoleId = @roleId", new { roleId }, tx);

        var rows = userIds.Where(u => !string.IsNullOrWhiteSpace(u)).Distinct()
            .Select(userId => new { UserId = userId, RoleId = roleId }).ToList();
        if (rows.Count > 0)
            await conn.ExecuteAsync("INSERT INTO AppUserRole (UserId, RoleId) VALUES (@UserId, @RoleId)", rows, tx);
    }
}

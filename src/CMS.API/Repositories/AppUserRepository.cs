using System.Data;
using CMS.API.Data;
using CMS.API.Models;
using Dapper;
using Microsoft.Data.SqlClient;

namespace CMS.API.Repositories;

public class AppUserRepository(IDbConnectionFactory db, RowAuditWriter audit) : IAppUserRepository
{
    private const string TableName = "AppUser";

    private const int ForeignKeyViolation = 547;

    // PasswordHash is never selected.
    private const string SelectSql = """
        SELECT u.pkid, u.UserId, u.UserName, u.IsActive, u.PasswordUpdatedTime,
               (SELECT COUNT(*) FROM AppUserRole ur WHERE ur.UserId = u.UserId) AS RoleCount
        FROM AppUser u
        """;

    private const string OrderBySql = " ORDER BY u.UserId ASC";

    public async Task<IEnumerable<AppUser>> GetAllAsync()
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.QueryAsync<AppUser>(SelectSql + OrderBySql);
    }

    public async Task<IEnumerable<AppUser>> QueryAsync(AppUserQuery query)
    {
        var where = new List<string>();
        var p = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            where.Add("(u.UserId LIKE @Keyword OR u.UserName LIKE @Keyword)");
            p.Add("Keyword", $"%{query.Keyword.Trim()}%");
        }
        if (query.IsActive.HasValue)
        {
            where.Add("u.IsActive = @IsActive");
            p.Add("IsActive", query.IsActive);
        }
        if (!string.IsNullOrWhiteSpace(query.RoleId))
        {
            where.Add("EXISTS (SELECT 1 FROM AppUserRole ur WHERE ur.UserId = u.UserId AND ur.RoleId = @RoleId)");
            p.Add("RoleId", query.RoleId);
        }

        var sql = SelectSql
            + (where.Count > 0 ? " WHERE " + string.Join(" AND ", where) : "")
            + OrderBySql;

        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.QueryAsync<AppUser>(sql, p);
    }

    public async Task<AppUser?> GetByIdAsync(int pkid)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await LoadAsync(conn, null, pkid);
    }

    public async Task<bool> UserIdExistsAsync(string userId)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM AppUser WHERE UserId = @userId", new { userId }) > 0;
    }

    public async Task<AppUserCredential?> GetCredentialAsync(string userId)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        var user = await conn.QuerySingleOrDefaultAsync<AppUserCredential>(
            "SELECT UserId, UserName, IsActive, PasswordHash FROM AppUser WHERE UserId = @userId", new { userId });
        // SQL `=` ignores case and trailing spaces under the default collation; login needs an exact match.
        if (user is null || !string.Equals(user.UserId, userId, StringComparison.Ordinal)) return null;

        user.RoleIds = (await conn.QueryAsync<string>(
            "SELECT RoleId FROM AppUserRole WHERE UserId = @UserId ORDER BY RoleId", new { user.UserId })).ToList();
        return user;
    }

    public async Task<int> CreateAsync(AppUserRequest request, string passwordHash)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        using var tx = conn.BeginTransaction();
        try
        {
            var pkid = await conn.ExecuteScalarAsync<int>("""
                INSERT INTO AppUser (UserId, UserName, IsActive, PasswordHash, PasswordUpdatedTime)
                VALUES (@UserId, @UserName, @IsActive, @PasswordHash, GETUTCDATE());
                SELECT CAST(SCOPE_IDENTITY() AS int);
                """, new { request.UserId, request.UserName, request.IsActive, PasswordHash = passwordHash }, tx);

            await SyncRolesAsync(conn, tx, request.UserId, request.RoleIds);
            await audit.LogInsertAsync(TableName, (await LoadAsync(conn, tx, pkid))!, tx);
            tx.Commit();
            return pkid;
        }
        catch (SqlException ex) when (ex.Number == ForeignKeyViolation)
        {
            throw new InvalidReferenceException("指定的角色不存在");
        }
    }

    public async Task<bool> UpdateAsync(AppUserRequest request)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        using var tx = conn.BeginTransaction();
        try
        {
            var before = await LoadAsync(conn, tx, request.Pkid);
            if (before is null) return false;

            // UserId is the table PK (referenced by AppUserRole), so it is not updatable.
            // PasswordHash is only changed by SetPasswordAsync.
            await conn.ExecuteAsync("""
                UPDATE AppUser
                SET UserName = @UserName, IsActive = @IsActive
                WHERE pkid = @Pkid
                """, new { request.UserName, request.IsActive, request.Pkid }, tx);

            await SyncRolesAsync(conn, tx, before.UserId, request.RoleIds);
            await audit.LogUpdateAsync(TableName, before, (await LoadAsync(conn, tx, request.Pkid))!, tx);
            tx.Commit();
            return true;
        }
        catch (SqlException ex) when (ex.Number == ForeignKeyViolation)
        {
            throw new InvalidReferenceException("指定的角色不存在");
        }
    }

    public Task<bool> UpdateUserNameAsync(string userId, string userName)
        => UpdateByUserIdAsync(userId,
            "UPDATE AppUser SET UserName = @userName WHERE pkid = @pkid", new { userName });

    /// <summary>The audit row lists PasswordUpdatedTime; the hash itself is never loaded.</summary>
    public Task<bool> SetPasswordAsync(string userId, string passwordHash, DateTime updatedUtc)
        => UpdateByUserIdAsync(userId, """
            UPDATE AppUser
            SET PasswordHash = @passwordHash, PasswordUpdatedTime = @updatedUtc
            WHERE pkid = @pkid
            """, new { passwordHash, updatedUtc });

    public async Task<bool> DeleteAsync(int pkid)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        using var tx = conn.BeginTransaction();

        var before = await LoadAsync(conn, tx, pkid);
        if (before is null) return false;

        await conn.ExecuteAsync("DELETE FROM AppUserRole WHERE UserId = @UserId", new { before.UserId }, tx);
        await conn.ExecuteAsync("DELETE FROM AppUser WHERE pkid = @pkid", new { pkid }, tx);
        await audit.LogDeleteAsync(TableName, before, tx);
        tx.Commit();
        return true;
    }

    /// <summary>Single-row UPDATE located by UserId; <paramref name="sql"/> gets @pkid plus <paramref name="values"/>.</summary>
    private async Task<bool> UpdateByUserIdAsync(string userId, string sql, object values)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        using var tx = conn.BeginTransaction();

        var pkid = await conn.ExecuteScalarAsync<int?>(
            "SELECT pkid FROM AppUser WHERE UserId = @userId", new { userId }, tx);
        if (pkid is null) return false;
        var before = (await LoadAsync(conn, tx, pkid.Value))!;

        var p = new DynamicParameters(values);
        p.Add("pkid", pkid.Value);
        await conn.ExecuteAsync(sql, p, tx);

        await audit.LogUpdateAsync(TableName, before, (await LoadAsync(conn, tx, pkid.Value))!, tx);
        tx.Commit();
        return true;
    }

    private static async Task<AppUser?> LoadAsync(IDbConnection conn, IDbTransaction? tx, int pkid)
    {
        var user = await conn.QuerySingleOrDefaultAsync<AppUser>(SelectSql + " WHERE u.pkid = @pkid", new { pkid }, tx);
        if (user is null) return null;

        // n-n: separate query on same connection
        user.Roles = (await conn.QueryAsync<AppRoleLookup>("""
            SELECT r.RoleId, r.RoleName
            FROM AppUserRole ur
            INNER JOIN AppRole r ON r.RoleId = ur.RoleId
            WHERE ur.UserId = @UserId
            ORDER BY r.RoleId ASC
            """, new { user.UserId }, tx)).ToList();

        return user;
    }

    // n-n: delete-then-reinsert
    private static async Task SyncRolesAsync(IDbConnection conn, IDbTransaction tx, string userId, IEnumerable<string> roleIds)
    {
        await conn.ExecuteAsync("DELETE FROM AppUserRole WHERE UserId = @userId", new { userId }, tx);

        var rows = roleIds.Where(r => !string.IsNullOrWhiteSpace(r)).Distinct()
            .Select(roleId => new { UserId = userId, RoleId = roleId }).ToList();
        if (rows.Count > 0)
            await conn.ExecuteAsync("INSERT INTO AppUserRole (UserId, RoleId) VALUES (@UserId, @RoleId)", rows, tx);
    }
}

using System.Data;
using CMS.API.Data;
using CMS.API.Models;
using Dapper;
using Microsoft.Data.SqlClient;

namespace CMS.API.Repositories;

public class AppUserRepository(IDbConnectionFactory db) : IAppUserRepository
{
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
        var user = await conn.QuerySingleOrDefaultAsync<AppUser>(SelectSql + " WHERE u.pkid = @pkid", new { pkid });
        if (user is null) return null;

        // n-n: separate query on same connection
        user.Roles = (await conn.QueryAsync<AppRoleLookup>("""
            SELECT r.RoleId, r.RoleName
            FROM AppUserRole ur
            INNER JOIN AppRole r ON r.RoleId = ur.RoleId
            WHERE ur.UserId = @UserId
            ORDER BY r.RoleId ASC
            """, new { user.UserId })).ToList();

        return user;
    }

    public async Task<bool> UserIdExistsAsync(string userId)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM AppUser WHERE UserId = @userId", new { userId }) > 0;
    }

    public async Task<int> CreateAsync(AppUserRequest request, string passwordHash)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        using var tx = conn.BeginTransaction();
        try
        {
            var pkid = await conn.ExecuteScalarAsync<int>("""
                INSERT INTO AppUser (UserId, UserName, IsActive, PasswordHash, PasswordUpdatedTime, MustChangePassword)
                VALUES (@UserId, @UserName, @IsActive, @PasswordHash, GETUTCDATE(), 1);
                SELECT CAST(SCOPE_IDENTITY() AS int);
                """, new { request.UserId, request.UserName, request.IsActive, PasswordHash = passwordHash }, tx);

            await SyncRolesAsync(conn, tx, request.UserId, request.RoleIds);
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
            // UserId is the table PK (referenced by AppUserRole), so it is not updatable.
            var userId = await conn.ExecuteScalarAsync<string?>(
                "SELECT UserId FROM AppUser WHERE pkid = @Pkid", new { request.Pkid }, tx);
            if (userId is null) return false;

            // PasswordHash is only changed by the reset / change / rehash password methods.
            await conn.ExecuteAsync("""
                UPDATE AppUser
                SET UserName = @UserName, IsActive = @IsActive
                WHERE pkid = @Pkid
                """, new { request.UserName, request.IsActive, request.Pkid }, tx);

            await SyncRolesAsync(conn, tx, userId, request.RoleIds);
            tx.Commit();
            return true;
        }
        catch (SqlException ex) when (ex.Number == ForeignKeyViolation)
        {
            throw new InvalidReferenceException("指定的角色不存在");
        }
    }

    public async Task<bool> ResetPasswordAsync(int pkid, string passwordHash)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.ExecuteAsync("""
            UPDATE AppUser
            SET PasswordHash = @passwordHash, PasswordUpdatedTime = GETUTCDATE(), MustChangePassword = 1
            WHERE pkid = @pkid
            """, new { pkid, passwordHash }) > 0;
    }

    private const string CredentialSql = """
        SELECT pkid, UserId, UserName, IsActive, PasswordHash, PasswordUpdatedTime, MustChangePassword
        FROM AppUser
        """;

    public async Task<AppUserCredential?> GetCredentialAsync(string userId)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await WithRoleIdsAsync(conn, await conn.QuerySingleOrDefaultAsync<AppUserCredential>(
            CredentialSql + " WHERE UserId = @userId", new { userId }));
    }

    public async Task<AppUserCredential?> GetCredentialAsync(int pkid)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await WithRoleIdsAsync(conn, await conn.QuerySingleOrDefaultAsync<AppUserCredential>(
            CredentialSql + " WHERE pkid = @pkid", new { pkid }));
    }

    private static async Task<AppUserCredential?> WithRoleIdsAsync(IDbConnection conn, AppUserCredential? user)
    {
        if (user is null) return null;
        var roleIds = await conn.QueryAsync<string>(
            "SELECT RTRIM(RoleId) FROM AppUserRole WHERE UserId = @UserId", new { user.UserId });
        user.RoleIds = roleIds.ToList();
        return user;
    }

    public async Task<bool> ChangePasswordAsync(int pkid, string passwordHash)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.ExecuteAsync("""
            UPDATE AppUser
            SET PasswordHash = @passwordHash, PasswordUpdatedTime = GETUTCDATE(), MustChangePassword = 0
            WHERE pkid = @pkid
            """, new { pkid, passwordHash }) > 0;
    }

    public async Task<bool> RehashPasswordAsync(int pkid, string passwordHash)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.ExecuteAsync(
            "UPDATE AppUser SET PasswordHash = @passwordHash WHERE pkid = @pkid", new { pkid, passwordHash }) > 0;
    }

    public async Task<bool> DeleteAsync(int pkid)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        using var tx = conn.BeginTransaction();

        var userId = await conn.ExecuteScalarAsync<string?>(
            "SELECT UserId FROM AppUser WHERE pkid = @pkid", new { pkid }, tx);
        if (userId is null) return false;

        await conn.ExecuteAsync("DELETE FROM AppUserRole WHERE UserId = @userId", new { userId }, tx);
        await conn.ExecuteAsync("DELETE FROM AppUser WHERE pkid = @pkid", new { pkid }, tx);
        tx.Commit();
        return true;
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

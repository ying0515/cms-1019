using System.Data;
using CMS.API.Data;
using CMS.API.Models;
using Dapper;
using Microsoft.Data.SqlClient;

namespace CMS.API.Repositories;

public class CourseGroupRepository(IDbConnectionFactory db, RowAuditWriter audit) : ICourseGroupRepository
{
    private const string TableName = "CourseGroup";

    private const string SelectSql = """
        SELECT g.pkid, g.Description
        FROM CourseGroup g
        """;

    private const string OrderBySql = " ORDER BY g.pkid DESC";

    private const int ForeignKeyViolation = 547;

    public async Task<IEnumerable<CourseGroup>> GetAllAsync()
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.QueryAsync<CourseGroup>(SelectSql + OrderBySql);
    }

    public async Task<IEnumerable<CourseGroup>> QueryAsync(CourseGroupQuery query)
    {
        var where = new List<string>();
        var p = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            where.Add("g.Description LIKE @Keyword");
            p.Add("Keyword", $"%{query.Keyword.Trim()}%");
        }

        var sql = SelectSql
            + (where.Count > 0 ? " WHERE " + string.Join(" AND ", where) : "")
            + OrderBySql;

        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.QueryAsync<CourseGroup>(sql, p);
    }

    public async Task<CourseGroup?> GetByIdAsync(short pkid)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await LoadAsync(conn, null, pkid);
    }

    public async Task<short> CreateAsync(CourseGroupRequest request)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        using var tx = conn.BeginTransaction();
        var pkid = await conn.ExecuteScalarAsync<short>("""
            INSERT INTO CourseGroup (Description) VALUES (@Description);
            SELECT CAST(SCOPE_IDENTITY() AS smallint);
            """, request, tx);

        await audit.LogInsertAsync(TableName, (await LoadAsync(conn, tx, pkid))!, tx);
        tx.Commit();
        return pkid;
    }

    public async Task<bool> UpdateAsync(CourseGroupRequest request)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        using var tx = conn.BeginTransaction();
        var before = await LoadAsync(conn, tx, request.Pkid);
        if (before is null) return false;

        await conn.ExecuteAsync("UPDATE CourseGroup SET Description = @Description WHERE pkid = @Pkid", request, tx);

        await audit.LogUpdateAsync(TableName, before, (await LoadAsync(conn, tx, request.Pkid))!, tx);
        tx.Commit();
        return true;
    }

    public async Task<bool> DeleteAsync(short pkid)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        using var tx = conn.BeginTransaction();
        var before = await LoadAsync(conn, tx, pkid);
        if (before is null) return false;

        try
        {
            await conn.ExecuteAsync("DELETE FROM CourseGroup WHERE pkid = @pkid", new { pkid }, tx);
        }
        catch (SqlException ex) when (ex.Number == ForeignKeyViolation)
        {
            // Referenced by Course / PartnerCourseGroup
            throw new ReferenceConflictException($"課程群組「{before.Description}」已被使用，無法刪除");
        }

        await audit.LogDeleteAsync(TableName, before, tx);
        tx.Commit();
        return true;
    }

    private static Task<CourseGroup?> LoadAsync(IDbConnection conn, IDbTransaction? tx, short pkid)
        => conn.QuerySingleOrDefaultAsync<CourseGroup>(SelectSql + " WHERE g.pkid = @pkid", new { pkid }, tx);
}

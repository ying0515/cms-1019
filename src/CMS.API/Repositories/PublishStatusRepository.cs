using System.Data;
using CMS.API.Data;
using CMS.API.Models;
using Dapper;
using Microsoft.Data.SqlClient;

namespace CMS.API.Repositories;

public class PublishStatusRepository(IDbConnectionFactory db, RowAuditWriter audit) : IPublishStatusRepository
{
    private const string TableName = "PublishStatus";

    private const string SelectSql = """
        SELECT s.pkid, s.Description, s.IsDraft, s.IsPublished, s.IsDiscontinued
        FROM PublishStatus s
        """;

    private const string OrderBySql = " ORDER BY s.pkid ASC";

    private const int ForeignKeyViolation = 547;

    public async Task<IEnumerable<PublishStatus>> GetAllAsync()
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.QueryAsync<PublishStatus>(SelectSql + OrderBySql);
    }

    public async Task<IEnumerable<PublishStatus>> QueryAsync(PublishStatusQuery query)
    {
        var where = new List<string>();
        var p = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            where.Add("s.Description LIKE @Keyword");
            p.Add("Keyword", $"%{query.Keyword.Trim()}%");
        }
        if (query.IsDraft.HasValue)
        {
            where.Add("s.IsDraft = @IsDraft");
            p.Add("IsDraft", query.IsDraft);
        }
        if (query.IsPublished.HasValue)
        {
            where.Add("s.IsPublished = @IsPublished");
            p.Add("IsPublished", query.IsPublished);
        }
        if (query.IsDiscontinued.HasValue)
        {
            where.Add("s.IsDiscontinued = @IsDiscontinued");
            p.Add("IsDiscontinued", query.IsDiscontinued);
        }

        var sql = SelectSql
            + (where.Count > 0 ? " WHERE " + string.Join(" AND ", where) : "")
            + OrderBySql;

        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.QueryAsync<PublishStatus>(sql, p);
    }

    public async Task<PublishStatus?> GetByIdAsync(byte pkid)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await LoadAsync(conn, null, pkid);
    }

    public async Task<bool> ExistsAsync(byte pkid)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM PublishStatus WHERE pkid = @pkid", new { pkid }) > 0;
    }

    public async Task CreateAsync(PublishStatusRequest request)
    {
        // pkid is not IDENTITY, so it is inserted explicitly
        using var conn = await db.CreateOpenConnectionAsync();
        using var tx = conn.BeginTransaction();
        await conn.ExecuteAsync("""
            INSERT INTO PublishStatus (pkid, Description, IsDraft, IsPublished, IsDiscontinued)
            VALUES (@Pkid, @Description, @IsDraft, @IsPublished, @IsDiscontinued)
            """, request, tx);

        await audit.LogInsertAsync(TableName, (await LoadAsync(conn, tx, request.Pkid))!, tx);
        tx.Commit();
    }

    public async Task<bool> UpdateAsync(PublishStatusRequest request)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        using var tx = conn.BeginTransaction();
        var before = await LoadAsync(conn, tx, request.Pkid);
        if (before is null) return false;

        await conn.ExecuteAsync("""
            UPDATE PublishStatus
            SET Description = @Description, IsDraft = @IsDraft, IsPublished = @IsPublished,
                IsDiscontinued = @IsDiscontinued
            WHERE pkid = @Pkid
            """, request, tx);

        await audit.LogUpdateAsync(TableName, before, (await LoadAsync(conn, tx, request.Pkid))!, tx);
        tx.Commit();
        return true;
    }

    public async Task<bool> DeleteAsync(byte pkid)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        using var tx = conn.BeginTransaction();
        var before = await LoadAsync(conn, tx, pkid);
        if (before is null) return false;

        try
        {
            await conn.ExecuteAsync("DELETE FROM PublishStatus WHERE pkid = @pkid", new { pkid }, tx);
        }
        catch (SqlException ex) when (ex.Number == ForeignKeyViolation)
        {
            // Referenced by Course / Promotion2
            throw new ReferenceConflictException($"發布狀態「{before.Description}」已被使用，無法刪除");
        }

        await audit.LogDeleteAsync(TableName, before, tx);
        tx.Commit();
        return true;
    }

    private static Task<PublishStatus?> LoadAsync(IDbConnection conn, IDbTransaction? tx, byte pkid)
        => conn.QuerySingleOrDefaultAsync<PublishStatus>(SelectSql + " WHERE s.pkid = @pkid", new { pkid }, tx);
}

using System.Data;
using CMS.API.Data;
using CMS.API.Models;
using Dapper;
using Microsoft.Data.SqlClient;

namespace CMS.API.Repositories;

public class PartnerRepository(IDbConnectionFactory db, RowAuditWriter audit) : IPartnerRepository
{
    private const string TableName = "Partner";

    private const string SelectSql = """
        SELECT p.pkid, p.Name, p.AppKey, p.NameOnPartnerMenu, p.NameOnCourseDetailPage,
               p.DisplayOrder, p.ImageFilename
        FROM Partner p
        """;

    private const string OrderBySql = " ORDER BY p.DisplayOrder ASC, p.pkid DESC";

    private const int ForeignKeyViolation = 547;

    public async Task<IEnumerable<Partner>> GetAllAsync()
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.QueryAsync<Partner>(SelectSql + OrderBySql);
    }

    public async Task<IEnumerable<Partner>> QueryAsync(PartnerQuery query)
    {
        var where = new List<string>();
        var p = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            where.Add("""
                (p.Name LIKE @Keyword OR p.AppKey LIKE @Keyword OR p.NameOnPartnerMenu LIKE @Keyword
                 OR p.NameOnCourseDetailPage LIKE @Keyword OR p.ImageFilename LIKE @Keyword)
                """);
            p.Add("Keyword", $"%{query.Keyword.Trim()}%");
        }

        var sql = SelectSql
            + (where.Count > 0 ? " WHERE " + string.Join(" AND ", where) : "")
            + OrderBySql;

        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.QueryAsync<Partner>(sql, p);
    }

    public async Task<Partner?> GetByIdAsync(short pkid)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await LoadAsync(conn, null, pkid);
    }

    public async Task<short> CreateAsync(PartnerRequest request)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        using var tx = conn.BeginTransaction();
        var pkid = await conn.ExecuteScalarAsync<short>("""
            INSERT INTO Partner (Name, AppKey, NameOnPartnerMenu, NameOnCourseDetailPage, DisplayOrder, ImageFilename)
            VALUES (@Name, @AppKey, @NameOnPartnerMenu, @NameOnCourseDetailPage, @DisplayOrder, @ImageFilename);
            SELECT CAST(SCOPE_IDENTITY() AS smallint);
            """, request, tx);

        await audit.LogInsertAsync(TableName, (await LoadAsync(conn, tx, pkid))!, tx);
        tx.Commit();
        return pkid;
    }

    public async Task<bool> UpdateAsync(PartnerRequest request)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        using var tx = conn.BeginTransaction();
        var before = await LoadAsync(conn, tx, request.Pkid);
        if (before is null) return false;

        await conn.ExecuteAsync("""
            UPDATE Partner
            SET Name = @Name, AppKey = @AppKey, NameOnPartnerMenu = @NameOnPartnerMenu,
                NameOnCourseDetailPage = @NameOnCourseDetailPage, DisplayOrder = @DisplayOrder,
                ImageFilename = @ImageFilename
            WHERE pkid = @Pkid
            """, request, tx);

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
            await conn.ExecuteAsync("DELETE FROM Partner WHERE pkid = @pkid", new { pkid }, tx);
        }
        catch (SqlException ex) when (ex.Number == ForeignKeyViolation)
        {
            // Referenced by Course / Certification / PartnerCourseGroup / Promotion2
            throw new ReferenceConflictException($"合作廠商「{before.Name}」已被使用，無法刪除");
        }

        await audit.LogDeleteAsync(TableName, before, tx);
        tx.Commit();
        return true;
    }

    private static Task<Partner?> LoadAsync(IDbConnection conn, IDbTransaction? tx, short pkid)
        => conn.QuerySingleOrDefaultAsync<Partner>(SelectSql + " WHERE p.pkid = @pkid", new { pkid }, tx);
}

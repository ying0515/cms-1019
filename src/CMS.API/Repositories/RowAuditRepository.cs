using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

/// <summary>Reads RowAudit; rows are written by <see cref="RowAuditWriter"/>.</summary>
public class RowAuditRepository(IDbConnectionFactory db) : IRowAuditRepository
{
    public async Task<IEnumerable<RowAuditEntry>> GetHistoryAsync(string tableName, string pkid)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        // datetime is only accurate to ~3 ms, so the IDENTITY pkid breaks ties in write order
        return await conn.QueryAsync<RowAuditEntry>("""
            SELECT a.[DateTime], a.UserName, a.ActionType, a.ActionDesc
            FROM RowAudit a
            WHERE a.TableName = @tableName AND a.PrimaryKeyValues = @pkid
            ORDER BY a.[DateTime] DESC, a.pkid DESC
            """, new { tableName, pkid });
    }
}

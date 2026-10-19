using CMS.API.Data;
using Dapper;

namespace CMS.API.Repositories;

public class SysConfigRepository(IDbConnectionFactory db) : ISysConfigRepository
{
    public async Task<string?> GetValueAsync(string configKey)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.ExecuteScalarAsync<string?>(
            "SELECT configValue FROM SysConfig WHERE configKey = @configKey", new { configKey });
    }
}

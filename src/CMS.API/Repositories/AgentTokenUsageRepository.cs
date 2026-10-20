using CMS.API.Data;
using CMS.API.Models;
using Dapper;
using Microsoft.Data.SqlClient;

namespace CMS.API.Repositories;

public class AgentTokenUsageRepository(IDbConnectionFactory db) : IAgentTokenUsageRepository
{
    private const int ForeignKeyViolation = 547;

    // Upsert on the natural key; HOLDLOCK keeps two concurrent submissions from both inserting
    private const string MergeSql = """
        MERGE AgentTokenUsage WITH (HOLDLOCK) AS t
        USING (SELECT @SessionId AS SessionId, @UsageDate AS UsageDate, @Model AS Model) AS s
           ON t.SessionId = s.SessionId AND t.UsageDate = s.UsageDate AND t.Model = s.Model
        WHEN MATCHED THEN
            UPDATE SET UserId = @UserId, Project = @Project,
                       InputTokens = @InputTokens, OutputTokens = @OutputTokens,
                       CacheWriteTokens = @CacheWriteTokens, CacheReadTokens = @CacheReadTokens,
                       Cost = @Cost, UpdatedTime = GETUTCDATE()
        WHEN NOT MATCHED THEN
            INSERT (SessionId, UsageDate, Model, UserId, Project,
                    InputTokens, OutputTokens, CacheWriteTokens, CacheReadTokens, Cost, UpdatedTime)
            VALUES (@SessionId, @UsageDate, @Model, @UserId, @Project,
                    @InputTokens, @OutputTokens, @CacheWriteTokens, @CacheReadTokens, @Cost, GETUTCDATE());
        """;

    private const string ReportSelectSql = """
        SELECT u.UserId, au.UserName, u.UsageDate, u.Project, u.Model,
               SUM(u.InputTokens) AS InputTokens, SUM(u.OutputTokens) AS OutputTokens,
               SUM(u.CacheWriteTokens) AS CacheWriteTokens, SUM(u.CacheReadTokens) AS CacheReadTokens,
               SUM(u.Cost) AS Cost,
               COUNT(CASE WHEN u.Cost IS NULL THEN 1 END) AS UnpricedCount,
               COUNT(DISTINCT u.SessionId) AS SessionCount
        FROM AgentTokenUsage u
        JOIN AppUser au ON au.UserId = u.UserId
        """;

    private const string ReportGroupOrderSql = """

        GROUP BY u.UserId, au.UserName, u.UsageDate, u.Project, u.Model
        ORDER BY u.UsageDate DESC, u.UserId, u.Project, u.Model
        """;

    public async Task<bool?> GetUserIsActiveAsync(string userId)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.QuerySingleOrDefaultAsync<bool?>(
            "SELECT IsActive FROM AppUser WHERE UserId = @UserId", new { UserId = userId });
    }

    public async Task UpsertAsync(AgentTokenUsageSubmitRequest request, CostFunction cost)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        using var tx = conn.BeginTransaction();
        try
        {
            // HOLDLOCK: a concurrent price change waits until these rows are in, then re-prices them
            var prices = await ModelPriceRepository.LoadPricesAsync(
                conn, tx, request.Items.Select(i => i.Model), holdLock: true);
            var rows = request.Items.Select(i => new
            {
                request.SessionId,
                UsageDate = i.UsageDate!.Value,
                i.Model,
                request.UserId,
                request.Project,
                i.InputTokens,
                i.OutputTokens,
                i.CacheWriteTokens,
                i.CacheReadTokens,
                Cost = cost(prices, i.ToUsageTokens()),
            });
            await conn.ExecuteAsync(MergeSql, rows, tx);
            tx.Commit();
        }
        catch (SqlException ex) when (ex.Number == ForeignKeyViolation)
        {
            throw new InvalidReferenceException("使用者不存在");
        }
    }

    public async Task<IEnumerable<AgentTokenUsageReportRow>> ReportAsync(AgentTokenUsageReportQuery query)
    {
        var where = new List<string>();
        var p = new DynamicParameters();
        // DateOnly? isn't bound by the type handler: add the unwrapped value only when present
        if (query.UsageDateFrom.HasValue)
        {
            where.Add("u.UsageDate >= @UsageDateFrom");
            p.Add("UsageDateFrom", query.UsageDateFrom.Value);
        }
        if (query.UsageDateTo.HasValue)
        {
            where.Add("u.UsageDate <= @UsageDateTo");
            p.Add("UsageDateTo", query.UsageDateTo.Value);
        }
        if (!string.IsNullOrWhiteSpace(query.UserId))
        {
            where.Add("u.UserId = @UserId");
            p.Add("UserId", query.UserId.Trim());
        }
        if (!string.IsNullOrWhiteSpace(query.Project))
        {
            where.Add("u.Project = @Project");
            p.Add("Project", query.Project.Trim());
        }
        if (!string.IsNullOrWhiteSpace(query.Model))
        {
            where.Add("u.Model = @Model");
            p.Add("Model", query.Model.Trim());
        }

        var sql = ReportSelectSql
            + (where.Count > 0 ? " WHERE " + string.Join(" AND ", where) : "")
            + ReportGroupOrderSql;
        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.QueryAsync<AgentTokenUsageReportRow>(sql, p);
    }
}

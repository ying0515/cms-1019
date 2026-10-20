using System.Data;
using CMS.API.Data;
using CMS.API.Models;
using Dapper;
using Microsoft.Data.SqlClient;

namespace CMS.API.Repositories;

public class ModelPriceRepository(IDbConnectionFactory db, RowAuditWriter audit) : IModelPriceRepository
{
    private const string TableName = "ModelPrice";

    private const string SelectSql = """
        SELECT mp.pkid, mp.Model, mp.EffectiveFrom, mp.InputPrice, mp.OutputPrice, mp.CacheWritePrice, mp.CacheReadPrice
        FROM ModelPrice mp
        """;

    private const string OrderBySql = " ORDER BY mp.Model ASC, mp.EffectiveFrom DESC";

    private const int UniqueConstraintViolation = 2627;
    private const int UniqueIndexViolation = 2601;

    /// <summary>Shared with the fake repository so the 409 message matches.</summary>
    public static DuplicateKeyException AlreadyPriced() => new("此模型在該生效日已有定價");

    public async Task<IEnumerable<ModelPrice>> GetAllAsync()
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.QueryAsync<ModelPrice>(SelectSql + OrderBySql);
    }

    public async Task<IEnumerable<ModelPrice>> QueryAsync(ModelPriceQuery query)
    {
        var where = new List<string>();
        var p = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            where.Add("mp.Model LIKE @Keyword");
            p.Add("Keyword", $"%{query.Keyword.Trim()}%");
        }
        // DateOnly? isn't bound by the type handler: add the unwrapped value only when present
        if (query.EffectiveFromFrom.HasValue)
        {
            where.Add("mp.EffectiveFrom >= @EffectiveFromFrom");
            p.Add("EffectiveFromFrom", query.EffectiveFromFrom.Value);
        }
        if (query.EffectiveFromTo.HasValue)
        {
            where.Add("mp.EffectiveFrom <= @EffectiveFromTo");
            p.Add("EffectiveFromTo", query.EffectiveFromTo.Value);
        }

        var sql = SelectSql
            + (where.Count > 0 ? " WHERE " + string.Join(" AND ", where) : "")
            + OrderBySql;

        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.QueryAsync<ModelPrice>(sql, p);
    }

    public async Task<ModelPrice?> GetByIdAsync(int pkid)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await LoadAsync(conn, null, pkid);
    }

    public async Task<int> CreateAsync(ModelPriceRequest request, CostFunction cost)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        using var tx = conn.BeginTransaction();
        try
        {
            var pkid = await conn.ExecuteScalarAsync<int>("""
                INSERT INTO ModelPrice (Model, EffectiveFrom, InputPrice, OutputPrice, CacheWritePrice, CacheReadPrice)
                VALUES (@Model, @EffectiveFrom, @InputPrice, @OutputPrice, @CacheWritePrice, @CacheReadPrice);
                SELECT CAST(SCOPE_IDENTITY() AS int);
                """, ToParams(request), tx);
            await RecomputeCostsAsync(conn, tx, [request.Model], cost);
            await audit.LogInsertAsync(TableName, (await LoadAsync(conn, tx, pkid))!, tx);
            tx.Commit();
            return pkid;
        }
        catch (SqlException ex) when (ex.Number is UniqueConstraintViolation or UniqueIndexViolation)
        {
            throw AlreadyPriced();
        }
    }

    public async Task<bool> UpdateAsync(ModelPriceRequest request, CostFunction cost)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        using var tx = conn.BeginTransaction();
        try
        {
            var before = await conn.QuerySingleOrDefaultAsync<ModelPrice>(
                SelectSql + " WITH (UPDLOCK) WHERE mp.pkid = @Pkid", new { request.Pkid }, tx);
            if (before is null) return false;

            await conn.ExecuteAsync("""
                UPDATE ModelPrice
                SET Model = @Model, EffectiveFrom = @EffectiveFrom, InputPrice = @InputPrice, OutputPrice = @OutputPrice,
                    CacheWritePrice = @CacheWritePrice, CacheReadPrice = @CacheReadPrice
                WHERE pkid = @Pkid
                """, ToParams(request), tx);
            await RecomputeCostsAsync(conn, tx, [before.Model, request.Model], cost);
            await audit.LogUpdateAsync(TableName, before, (await LoadAsync(conn, tx, request.Pkid))!, tx);
            tx.Commit();
            return true;
        }
        catch (SqlException ex) when (ex.Number is UniqueConstraintViolation or UniqueIndexViolation)
        {
            throw AlreadyPriced();
        }
    }

    public async Task<bool> DeleteAsync(int pkid, CostFunction cost)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        using var tx = conn.BeginTransaction();
        var before = await conn.QuerySingleOrDefaultAsync<ModelPrice>(
            SelectSql + " WITH (UPDLOCK) WHERE mp.pkid = @pkid", new { pkid }, tx);
        if (before is null) return false;

        await conn.ExecuteAsync("DELETE FROM ModelPrice WHERE pkid = @pkid", new { pkid }, tx);
        await RecomputeCostsAsync(conn, tx, [before.Model], cost);
        await audit.LogDeleteAsync(TableName, before, tx);
        tx.Commit();
        return true;
    }

    private static Task<ModelPrice?> LoadAsync(IDbConnection conn, IDbTransaction? tx, int pkid)
        => conn.QuerySingleOrDefaultAsync<ModelPrice>(SelectSql + " WHERE mp.pkid = @pkid", new { pkid }, tx);

    /// <summary>
    /// Prices of the given models. With <paramref name="holdLock"/> the rows (and the gaps between them) stay
    /// locked until the transaction ends, so a concurrent price change waits for the caller to commit.
    /// </summary>
    internal static async Task<List<ModelPrice>> LoadPricesAsync(
        IDbConnection conn, IDbTransaction tx, IEnumerable<string> models, bool holdLock = false)
    {
        var sql = holdLock
            ? SelectSql.Replace("FROM ModelPrice mp", "FROM ModelPrice mp WITH (HOLDLOCK)")
            : SelectSql;
        return (await conn.QueryAsync<ModelPrice>(sql + " WHERE mp.Model IN @Models",
            new { Models = models.Distinct(StringComparer.OrdinalIgnoreCase).ToArray() }, tx)).ToList();
    }

    /// <summary>Re-prices every usage row of the models (plain read → cost function → write the changed costs).</summary>
    private static async Task RecomputeCostsAsync(
        IDbConnection conn, IDbTransaction tx, string[] models, CostFunction cost)
    {
        var prices = await LoadPricesAsync(conn, tx, models);
        var rows = await conn.QueryAsync<UsageCostRow>("""
            SELECT pkid, Model, UsageDate, InputTokens, OutputTokens, CacheWriteTokens, CacheReadTokens, Cost
            FROM AgentTokenUsage WITH (UPDLOCK)
            WHERE Model IN @Models
            """, new { Models = models.Distinct(StringComparer.OrdinalIgnoreCase).ToArray() }, tx);

        var changed = rows
            .Select(r => new { r.Pkid, r.Cost, NewCost = cost(prices, r.ToUsageTokens()) })
            .Where(r => r.Cost != r.NewCost)
            .Select(r => new { r.Pkid, Cost = r.NewCost })
            .ToList();
        if (changed.Count > 0)
            await conn.ExecuteAsync("UPDATE AgentTokenUsage SET Cost = @Cost WHERE pkid = @Pkid", changed, tx);
    }

    private static object ToParams(ModelPriceRequest r) => new
    {
        r.Pkid,
        r.Model,
        // DateOnly? / decimal? params: unwrap so the DateOnly type handler binds the date
        EffectiveFrom = r.EffectiveFrom!.Value,
        InputPrice = r.InputPrice!.Value,
        OutputPrice = r.OutputPrice!.Value,
        CacheWritePrice = r.CacheWritePrice!.Value,
        CacheReadPrice = r.CacheReadPrice!.Value,
    };

    private sealed class UsageCostRow
    {
        public int Pkid { get; set; }
        public string Model { get; set; } = string.Empty;
        public DateOnly UsageDate { get; set; }
        public long InputTokens { get; set; }
        public long OutputTokens { get; set; }
        public long CacheWriteTokens { get; set; }
        public long CacheReadTokens { get; set; }
        public decimal? Cost { get; set; }

        public UsageTokens ToUsageTokens()
            => new(Model, UsageDate, InputTokens, OutputTokens, CacheWriteTokens, CacheReadTokens);
    }
}

using System.Data;
using CMS.API.Data;
using CMS.API.Models;
using Dapper;
using Microsoft.Data.SqlClient;

namespace CMS.API.Repositories;

public class FeaturedPromoItemRepository(IDbConnectionFactory db) : IFeaturedPromoItemRepository
{
    private const string SelectSql = """
        SELECT f.pkid, f.ScheduleOn, f.TrainingCenter_pkid AS TrainingCenterPkid, f.Slot,
               f.Promotion_pkid AS PromotionPkid, f.Topic, f.Description,
               tc.pkid, tc.Name,
               p.pkid, p.PromoCode, p.Topic, p.Description
        FROM FeaturedPromoItem f
        INNER JOIN TrainingCenter tc ON tc.pkid = f.TrainingCenter_pkid
        INNER JOIN Promotion2 p ON p.pkid = f.Promotion_pkid
        """;

    private const string OrderBySql = " ORDER BY f.ScheduleOn ASC, tc.DisplayOrder ASC, f.TrainingCenter_pkid ASC, f.Slot ASC";

    // TrainingCenter / Promotion2 segments each start at their pkid column
    private const string SplitOn = "pkid,pkid";

    private const int ForeignKeyViolation = 547;
    private const int UniqueConstraintViolation = 2627;
    private const int UniqueIndexViolation = 2601;

    public async Task<IEnumerable<FeaturedPromoItem>> GetAllAsync()
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await QueryItemsAsync(conn, SelectSql + OrderBySql);
    }

    public async Task<IEnumerable<FeaturedPromoItem>> QueryAsync(FeaturedPromoItemQuery query)
    {
        var where = new List<string>();
        var p = new DynamicParameters();

        if (query.TrainingCenterPkid.HasValue)
        {
            where.Add("f.TrainingCenter_pkid = @TrainingCenterPkid");
            p.Add("TrainingCenterPkid", query.TrainingCenterPkid);
        }
        if (query.WeekOf.HasValue)
        {
            var monday = FeaturedPromoItemQuery.WeekStart(query.WeekOf.Value);
            where.Add("f.ScheduleOn >= @WeekFrom AND f.ScheduleOn <= @WeekTo");
            p.Add("WeekFrom", monday);
            p.Add("WeekTo", monday.AddDays(6));
        }

        var sql = SelectSql
            + (where.Count > 0 ? " WHERE " + string.Join(" AND ", where) : "")
            + OrderBySql;

        using var conn = await db.CreateOpenConnectionAsync();
        return await QueryItemsAsync(conn, sql, p);
    }

    public async Task<FeaturedPromoItem?> GetByIdAsync(int pkid)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return (await QueryItemsAsync(conn, SelectSql + " WHERE f.pkid = @pkid", new { pkid }))
            .SingleOrDefault();
    }

    public async Task<int> CreateAsync(FeaturedPromoItemRequest request)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        try
        {
            return await conn.ExecuteScalarAsync<int>("""
                INSERT INTO FeaturedPromoItem (ScheduleOn, TrainingCenter_pkid, Slot, Promotion_pkid, Topic, Description)
                VALUES (@ScheduleOn, @TrainingCenterPkid, @Slot, @PromotionPkid, @Topic, @Description);
                SELECT CAST(SCOPE_IDENTITY() AS int);
                """, ToParams(request));
        }
        catch (SqlException ex) when (ex.Number == ForeignKeyViolation)
        {
            throw InvalidReference();
        }
        catch (SqlException ex) when (ex.Number is UniqueConstraintViolation or UniqueIndexViolation)
        {
            throw SlotTaken(request);
        }
    }

    public async Task<bool> UpdateAsync(FeaturedPromoItemRequest request)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        try
        {
            return await conn.ExecuteAsync("""
                UPDATE FeaturedPromoItem
                SET ScheduleOn = @ScheduleOn, TrainingCenter_pkid = @TrainingCenterPkid, Slot = @Slot,
                    Promotion_pkid = @PromotionPkid, Topic = @Topic, Description = @Description
                WHERE pkid = @Pkid
                """, ToParams(request)) > 0;
        }
        catch (SqlException ex) when (ex.Number == ForeignKeyViolation)
        {
            throw InvalidReference();
        }
        catch (SqlException ex) when (ex.Number is UniqueConstraintViolation or UniqueIndexViolation)
        {
            throw SlotTaken(request);
        }
    }

    public async Task<bool> DeleteAsync(int pkid)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.ExecuteAsync("DELETE FROM FeaturedPromoItem WHERE pkid = @pkid", new { pkid }) > 0;
    }

    public async Task<bool> MoveToSlotAsync(int pkid, byte targetSlot)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        // One statement, so the UNIQUE (ScheduleOn, TrainingCenter_pkid, Slot) constraint is checked
        // after both rows have swapped.
        return await conn.ExecuteAsync("""
            UPDATE f
            SET Slot = CASE WHEN f.pkid = s.pkid THEN @TargetSlot ELSE s.Slot END
            FROM FeaturedPromoItem f
            INNER JOIN FeaturedPromoItem s
                ON s.ScheduleOn = f.ScheduleOn AND s.TrainingCenter_pkid = f.TrainingCenter_pkid
            WHERE s.pkid = @Pkid AND (f.pkid = s.pkid OR f.Slot = @TargetSlot)
            """, new { Pkid = pkid, TargetSlot = targetSlot }) > 0;
    }

    private static Task<IEnumerable<FeaturedPromoItem>> QueryItemsAsync(IDbConnection conn, string sql, object? param = null)
        => conn.QueryAsync<FeaturedPromoItem, TrainingCenterLookup, PromotionLookup, FeaturedPromoItem>(
            sql,
            (item, trainingCenter, promotion) =>
            {
                item.TrainingCenter = trainingCenter;
                item.Promotion = promotion;
                return item;
            },
            param,
            splitOn: SplitOn);

    // Unwrap DateOnly? so the registered DateOnly type handler binds the parameter
    private static object ToParams(FeaturedPromoItemRequest r) => new
    {
        r.Pkid,
        ScheduleOn = r.ScheduleOn!.Value,
        r.TrainingCenterPkid, r.Slot, r.PromotionPkid, r.Topic, r.Description,
    };

    private static InvalidReferenceException InvalidReference()
        => new("訓練中心或推廣代碼不存在");

    /// <summary>Shared with the fake repository so the 409 message matches.</summary>
    public static DuplicateKeyException SlotTaken(FeaturedPromoItemRequest r)
        => new($"{r.ScheduleOn:yyyy-MM-dd} 第 {r.Slot} 則已有資料");
}

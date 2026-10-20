using CMS.API.Models;
using CMS.API.Repositories;

namespace CMS.API.Tests.Infrastructure;

/// <summary>
/// In-memory IFeaturedPromoItemRepository so endpoint tests run without SQL Server.
/// Seeds TrainingCenter / Promotion2 rows for the JOINs, FOREIGN KEYs and lookups, and mirrors
/// the UNIQUE (ScheduleOn, TrainingCenter_pkid, Slot) constraint.
/// </summary>
public class FakeFeaturedPromoItemRepository : IFeaturedPromoItemRepository
{
    private readonly object _lock = new();
    private int _nextPkid = 7;

    public List<(short Pkid, string Name, int DisplayOrder)> TrainingCenters { get; } =
    [
        (1, "台北", 1),
        (2, "新竹", 2),
        (5, "高雄", 4),
        (3, "台中", 3),
    ];

    public List<PromotionLookup> Promotions { get; } =
    [
        new() { Pkid = 1, PromoCode = "20251204_SkillTrainAI", Topic = "成為能AI協作的程式設計師", Description = "轉職就業養成班，三大主流語言任你選" },
        new() { Pkid = 2, PromoCode = "251211_GoogleAI", Topic = "Google AI工具一次掌握", Description = "不需技術基礎！最新Google AI實戰課程" },
        new() { Pkid = 3, PromoCode = "20251215_n8n", Topic = "n8n自動化三部曲", Description = "從自動化新手到企業級AI架構師學習路徑" },
        new() { Pkid = 4, PromoCode = "240614_MSAI", Topic = "教你把AI變成實戰力", Description = "用GitHub Copilot快速提升效率" },
    ];

    // Week under test: Mon 2026-03-16 … Sun 2026-03-22
    private readonly List<FeaturedPromoItemRequest> _items =
    [
        Row(1, new DateOnly(2026, 3, 15), 1, 1, 1),  // Sunday of the previous week
        Row(2, new DateOnly(2026, 3, 16), 1, 1, 1),  // Monday
        Row(3, new DateOnly(2026, 3, 16), 1, 2, 2),
        Row(4, new DateOnly(2026, 3, 16), 2, 1, 3),  // other training center
        Row(5, new DateOnly(2026, 3, 22), 1, 3, 2),  // Sunday
        Row(6, new DateOnly(2026, 3, 23), 1, 1, 3),  // Monday of the next week
    ];

    private static FeaturedPromoItemRequest Row(int pkid, DateOnly on, short tc, byte slot, int promo) => new()
    {
        Pkid = pkid, ScheduleOn = on, TrainingCenterPkid = tc, Slot = slot, PromotionPkid = promo,
        Topic = $"主題 {pkid}", Description = $"說明 {pkid}",
    };

    public Task<IEnumerable<FeaturedPromoItem>> GetAllAsync()
    {
        lock (_lock)
            return Task.FromResult<IEnumerable<FeaturedPromoItem>>(Sort(_items).Select(ToItem).ToList());
    }

    public Task<IEnumerable<FeaturedPromoItem>> QueryAsync(FeaturedPromoItemQuery query)
    {
        lock (_lock)
        {
            IEnumerable<FeaturedPromoItemRequest> q = _items;
            if (query.TrainingCenterPkid.HasValue) q = q.Where(x => x.TrainingCenterPkid == query.TrainingCenterPkid);
            if (query.WeekOf.HasValue)
            {
                var monday = FeaturedPromoItemQuery.WeekStart(query.WeekOf.Value);
                q = q.Where(x => x.ScheduleOn >= monday && x.ScheduleOn <= monday.AddDays(6));
            }
            return Task.FromResult<IEnumerable<FeaturedPromoItem>>(Sort(q).Select(ToItem).ToList());
        }
    }

    public Task<FeaturedPromoItem?> GetByIdAsync(int pkid)
    {
        lock (_lock)
        {
            var row = _items.FirstOrDefault(x => x.Pkid == pkid);
            return Task.FromResult(row is null ? null : ToItem(row));
        }
    }

    public Task<int> CreateAsync(FeaturedPromoItemRequest request)
    {
        lock (_lock)
        {
            EnsureValid(request, exceptPkid: null);
            var pkid = _nextPkid++;
            _items.Add(Copy(request, pkid));
            return Task.FromResult(pkid);
        }
    }

    public Task<bool> UpdateAsync(FeaturedPromoItemRequest request)
    {
        lock (_lock)
        {
            var index = _items.FindIndex(x => x.Pkid == request.Pkid);
            if (index < 0) return Task.FromResult(false);
            EnsureValid(request, exceptPkid: request.Pkid);
            _items[index] = Copy(request, request.Pkid);
            return Task.FromResult(true);
        }
    }

    public Task<bool> DeleteAsync(int pkid)
    {
        lock (_lock)
            return Task.FromResult(_items.RemoveAll(x => x.Pkid == pkid) > 0);
    }

    public Task<bool> MoveToSlotAsync(int pkid, byte targetSlot)
    {
        lock (_lock)
        {
            var row = _items.FirstOrDefault(x => x.Pkid == pkid);
            if (row is null) return Task.FromResult(false);
            var other = _items.FirstOrDefault(x => x.ScheduleOn == row.ScheduleOn
                && x.TrainingCenterPkid == row.TrainingCenterPkid && x.Slot == targetSlot);
            if (other is not null) other.Slot = row.Slot;
            row.Slot = targetSlot;
            return Task.FromResult(true);
        }
    }

    // Mirrors the FOREIGN KEYs (SQL 547) and the UNIQUE constraint (SQL 2627)
    private void EnsureValid(FeaturedPromoItemRequest r, int? exceptPkid)
    {
        if (TrainingCenters.All(t => t.Pkid != r.TrainingCenterPkid) || Promotions.All(p => p.Pkid != r.PromotionPkid))
            throw new InvalidReferenceException("訓練中心或推廣代碼不存在");
        if (_items.Any(x => x.Pkid != exceptPkid && x.ScheduleOn == r.ScheduleOn
                && x.TrainingCenterPkid == r.TrainingCenterPkid && x.Slot == r.Slot))
            throw FeaturedPromoItemRepository.SlotTaken(r);
    }

    // Mirrors ORDER BY ScheduleOn, TrainingCenter.DisplayOrder, TrainingCenter_pkid, Slot
    private IEnumerable<FeaturedPromoItemRequest> Sort(IEnumerable<FeaturedPromoItemRequest> items)
        => items.OrderBy(x => x.ScheduleOn)
            .ThenBy(x => TrainingCenters.FirstOrDefault(t => t.Pkid == x.TrainingCenterPkid).DisplayOrder)
            .ThenBy(x => x.TrainingCenterPkid)
            .ThenBy(x => x.Slot);

    private FeaturedPromoItem ToItem(FeaturedPromoItemRequest r)
    {
        var tc = TrainingCenters.FirstOrDefault(t => t.Pkid == r.TrainingCenterPkid);
        var promo = Promotions.FirstOrDefault(p => p.Pkid == r.PromotionPkid);
        return new FeaturedPromoItem
        {
            Pkid = r.Pkid,
            ScheduleOn = r.ScheduleOn!.Value,
            TrainingCenterPkid = r.TrainingCenterPkid,
            Slot = r.Slot,
            PromotionPkid = r.PromotionPkid,
            Topic = r.Topic,
            Description = r.Description,
            TrainingCenter = tc.Name is null ? null : new TrainingCenterLookup { Pkid = tc.Pkid, Name = tc.Name },
            Promotion = promo,
        };
    }

    private static FeaturedPromoItemRequest Copy(FeaturedPromoItemRequest r, int pkid) => new()
    {
        Pkid = pkid,
        ScheduleOn = r.ScheduleOn,
        TrainingCenterPkid = r.TrainingCenterPkid,
        Slot = r.Slot,
        PromotionPkid = r.PromotionPkid,
        Topic = r.Topic,
        Description = r.Description,
    };
}

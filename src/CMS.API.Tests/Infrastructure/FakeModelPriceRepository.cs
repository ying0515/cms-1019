using CMS.API.Data;
using CMS.API.Models;
using CMS.API.Repositories;

namespace CMS.API.Tests.Infrastructure;

/// <summary>
/// In-memory IModelPriceRepository so endpoint tests run without SQL Server. Seed mirrors database/agent-seed.sql
/// and the UNIQUE (Model, EffectiveFrom) index (case-insensitive, like the collation). Like the real repository it
/// re-prices usage rows through the CostFunction it is given; it never computes cost itself.
/// </summary>
public class FakeModelPriceRepository(FakeAgentTokenUsageRepository usage) : IModelPriceRepository
{
    private static readonly DateOnly Seeded = new(2026, 1, 1);

    private readonly object _lock = new();
    private int _nextPkid = 4;

    private readonly List<ModelPrice> _items =
    [
        new() { Pkid = 1, Model = "claude-opus-5-5", EffectiveFrom = Seeded, InputPrice = 4, OutputPrice = 20, CacheWritePrice = 8, CacheReadPrice = 0.2m },
        new() { Pkid = 2, Model = "claude-sonnet-5-5", EffectiveFrom = Seeded, InputPrice = 2, OutputPrice = 10, CacheWritePrice = 4, CacheReadPrice = 0.2m },
        new() { Pkid = 3, Model = "claude-haiku-5-5", EffectiveFrom = Seeded, InputPrice = 0.1m, OutputPrice = 0.5m, CacheWritePrice = 0.2m, CacheReadPrice = 0.01m },
    ];

    public IReadOnlyList<ModelPrice> Items { get { lock (_lock) return _items.Select(Clone).ToList(); } }

    public Task<IEnumerable<ModelPrice>> GetAllAsync()
    {
        lock (_lock) return Task.FromResult<IEnumerable<ModelPrice>>(Sort(_items).Select(Clone).ToList());
    }

    public Task<IEnumerable<ModelPrice>> QueryAsync(ModelPriceQuery query)
    {
        lock (_lock)
        {
            IEnumerable<ModelPrice> q = _items;
            if (!string.IsNullOrWhiteSpace(query.Keyword))
                q = q.Where(p => p.Model.Contains(query.Keyword.Trim(), StringComparison.OrdinalIgnoreCase));
            if (query.EffectiveFromFrom.HasValue) q = q.Where(p => p.EffectiveFrom >= query.EffectiveFromFrom);
            if (query.EffectiveFromTo.HasValue) q = q.Where(p => p.EffectiveFrom <= query.EffectiveFromTo);
            return Task.FromResult<IEnumerable<ModelPrice>>(Sort(q).Select(Clone).ToList());
        }
    }

    public Task<ModelPrice?> GetByIdAsync(int pkid)
    {
        lock (_lock)
        {
            var item = _items.SingleOrDefault(p => p.Pkid == pkid);
            return Task.FromResult(item is null ? null : Clone(item));
        }
    }

    public Task<int> CreateAsync(ModelPriceRequest request, CostFunction cost)
    {
        lock (_lock)
        {
            ThrowIfTaken(request, exceptPkid: null);
            var item = FromRequest(_nextPkid++, request);
            _items.Add(item);
            usage.RecomputeCosts([item.Model], Items, cost);
            return Task.FromResult(item.Pkid);
        }
    }

    public Task<bool> UpdateAsync(ModelPriceRequest request, CostFunction cost)
    {
        lock (_lock)
        {
            var index = _items.FindIndex(p => p.Pkid == request.Pkid);
            if (index < 0) return Task.FromResult(false);
            ThrowIfTaken(request, exceptPkid: request.Pkid);

            var oldModel = _items[index].Model;
            _items[index] = FromRequest(request.Pkid, request);
            usage.RecomputeCosts([oldModel, request.Model], Items, cost);
            return Task.FromResult(true);
        }
    }

    public Task<bool> DeleteAsync(int pkid, CostFunction cost)
    {
        lock (_lock)
        {
            var item = _items.SingleOrDefault(p => p.Pkid == pkid);
            if (item is null) return Task.FromResult(false);
            _items.Remove(item);
            usage.RecomputeCosts([item.Model], Items, cost);
            return Task.FromResult(true);
        }
    }

    private void ThrowIfTaken(ModelPriceRequest r, int? exceptPkid)
    {
        if (_items.Any(p => p.Pkid != exceptPkid
                && string.Equals(p.Model, r.Model, StringComparison.OrdinalIgnoreCase)
                && p.EffectiveFrom == r.EffectiveFrom))
            throw ModelPriceRepository.AlreadyPriced();
    }

    // Mirrors ORDER BY Model ASC, EffectiveFrom DESC
    private static IEnumerable<ModelPrice> Sort(IEnumerable<ModelPrice> items)
        => items.OrderBy(p => p.Model, StringComparer.OrdinalIgnoreCase).ThenByDescending(p => p.EffectiveFrom);

    private static ModelPrice FromRequest(int pkid, ModelPriceRequest r) => new()
    {
        Pkid = pkid,
        Model = r.Model,
        EffectiveFrom = r.EffectiveFrom!.Value,
        InputPrice = r.InputPrice!.Value,
        OutputPrice = r.OutputPrice!.Value,
        CacheWritePrice = r.CacheWritePrice!.Value,
        CacheReadPrice = r.CacheReadPrice!.Value,
    };

    private static ModelPrice Clone(ModelPrice p) => new()
    {
        Pkid = p.Pkid,
        Model = p.Model,
        EffectiveFrom = p.EffectiveFrom,
        InputPrice = p.InputPrice,
        OutputPrice = p.OutputPrice,
        CacheWritePrice = p.CacheWritePrice,
        CacheReadPrice = p.CacheReadPrice,
    };
}

using CMS.API.Data;
using CMS.API.Models;
using CMS.API.Repositories;

namespace CMS.API.Tests.Infrastructure;

/// <summary>
/// In-memory IAgentTokenUsageRepository so ingest and report tests run without SQL Server.
/// <paramref name="prices"/> reads the ModelPrice table (the fake price repository); cost always comes from the
/// CostFunction passed in, never from the fake.
/// </summary>
public class FakeAgentTokenUsageRepository(Func<IReadOnlyList<ModelPrice>> prices) : IAgentTokenUsageRepository
{
    private readonly object _lock = new();
    private readonly List<Row> _rows = [];

    public sealed record Row(string SessionId, DateOnly UsageDate, string Model, string UserId, string Project,
        long InputTokens, long OutputTokens, long CacheWriteTokens, long CacheReadTokens, decimal? Cost);

    /// <summary>
    /// AppUser rows (UserId → UserName, IsActive). Mirrors FakeAppUserRepository's seed: miles is inactive.
    /// </summary>
    public Dictionary<string, (string UserName, bool IsActive)> Users { get; } = new()
    {
        ["helen"] = ("helen", true),
        ["jenny"] = ("Jenny_Tsao", true),
        ["miles"] = ("Miles Sun", false),
    };

    public IReadOnlyList<Row> Rows { get { lock (_lock) return _rows.ToList(); } }

    public Task<bool?> GetUserIsActiveAsync(string userId)
        => Task.FromResult(Users.TryGetValue(userId, out var u) ? u.IsActive : (bool?)null);

    // Mirrors the MERGE: match on (SessionId, UsageDate, Model), overwrite with absolute totals
    public Task UpsertAsync(AgentTokenUsageSubmitRequest request, CostFunction cost)
    {
        var priceList = prices();
        lock (_lock)
        {
            foreach (var item in request.Items)
            {
                var date = item.UsageDate!.Value;
                _rows.RemoveAll(r => r.SessionId == request.SessionId && r.UsageDate == date && r.Model == item.Model);
                _rows.Add(new Row(request.SessionId, date, item.Model, request.UserId, request.Project,
                    item.InputTokens, item.OutputTokens, item.CacheWriteTokens, item.CacheReadTokens,
                    cost(priceList, item.ToUsageTokens())));
            }
        }
        return Task.CompletedTask;
    }

    /// <summary>Used by FakeModelPriceRepository: re-prices every row of the models (case-insensitive, like SQL).</summary>
    public void RecomputeCosts(IEnumerable<string> models, IReadOnlyList<ModelPrice> priceList, CostFunction cost)
    {
        var set = models.ToHashSet(StringComparer.OrdinalIgnoreCase);
        lock (_lock)
        {
            for (var i = 0; i < _rows.Count; i++)
            {
                var r = _rows[i];
                if (!set.Contains(r.Model)) continue;
                _rows[i] = r with
                {
                    Cost = cost(priceList, new UsageTokens(r.Model, r.UsageDate,
                        r.InputTokens, r.OutputTokens, r.CacheWriteTokens, r.CacheReadTokens)),
                };
            }
        }
    }

    // Mirrors the GROUP BY + ORDER BY UsageDate DESC, UserId, Project, Model
    public Task<IEnumerable<AgentTokenUsageReportRow>> ReportAsync(AgentTokenUsageReportQuery query)
    {
        lock (_lock)
        {
            var result = _rows
                .Where(r => query.UsageDateFrom is null || r.UsageDate >= query.UsageDateFrom)
                .Where(r => query.UsageDateTo is null || r.UsageDate <= query.UsageDateTo)
                .GroupBy(r => (r.UserId, r.UsageDate, r.Project, r.Model))
                .Select(g => new AgentTokenUsageReportRow
                {
                    UserId = g.Key.UserId,
                    UserName = Users[g.Key.UserId].UserName,
                    UsageDate = g.Key.UsageDate,
                    Project = g.Key.Project,
                    Model = g.Key.Model,
                    InputTokens = g.Sum(r => r.InputTokens),
                    OutputTokens = g.Sum(r => r.OutputTokens),
                    CacheWriteTokens = g.Sum(r => r.CacheWriteTokens),
                    CacheReadTokens = g.Sum(r => r.CacheReadTokens),
                    Cost = g.Any(r => r.Cost is not null) ? g.Sum(r => r.Cost ?? 0) : null,
                    UnpricedCount = g.Count(r => r.Cost is null),
                    SessionCount = g.Select(r => r.SessionId).Distinct().Count(),
                })
                .OrderByDescending(r => r.UsageDate)
                .ThenBy(r => r.UserId, StringComparer.Ordinal)
                .ThenBy(r => r.Project, StringComparer.Ordinal)
                .ThenBy(r => r.Model, StringComparer.Ordinal)
                .ToList();
            return Task.FromResult<IEnumerable<AgentTokenUsageReportRow>>(result);
        }
    }
}

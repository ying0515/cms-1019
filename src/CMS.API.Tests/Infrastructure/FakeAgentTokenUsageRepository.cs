using CMS.API.Models;
using CMS.API.Repositories;

namespace CMS.API.Tests.Infrastructure;

/// <summary>In-memory IAgentTokenUsageRepository so ingest and report tests run without SQL Server.</summary>
public class FakeAgentTokenUsageRepository : IAgentTokenUsageRepository
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
    public Task UpsertAsync(AgentTokenUsageSubmitRequest request)
    {
        lock (_lock)
        {
            foreach (var item in request.Items)
            {
                var date = item.UsageDate!.Value;
                _rows.RemoveAll(r => r.SessionId == request.SessionId && r.UsageDate == date && r.Model == item.Model);
                _rows.Add(new Row(request.SessionId, date, item.Model, request.UserId, request.Project,
                    item.InputTokens, item.OutputTokens, item.CacheWriteTokens, item.CacheReadTokens, null));
            }
        }
        return Task.CompletedTask;
    }

    // Mirrors the GROUP BY + ORDER BY UsageDate DESC, UserId, Project, Model
    public Task<IEnumerable<AgentTokenUsageReportRow>> ReportAsync(AgentTokenUsageReportQuery query)
    {
        lock (_lock)
        {
            var result = _rows
                .Where(r => query.UsageDateFrom is null || r.UsageDate >= query.UsageDateFrom)
                .Where(r => query.UsageDateTo is null || r.UsageDate <= query.UsageDateTo)
                .Where(r => string.IsNullOrWhiteSpace(query.UserId) || r.UserId == query.UserId.Trim())
                .Where(r => string.IsNullOrWhiteSpace(query.Project) || r.Project == query.Project.Trim())
                .Where(r => string.IsNullOrWhiteSpace(query.Model) || r.Model == query.Model.Trim())
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

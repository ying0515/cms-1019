using CMS.API.Data;
using CMS.API.Models;

namespace CMS.API.Repositories;

public interface IAgentTokenUsageRepository
{
    /// <summary>AppUser.IsActive for the user, or null when the user doesn't exist.</summary>
    Task<bool?> GetUserIsActiveAsync(string userId);

    /// <summary>
    /// Upserts every item on (SessionId, UsageDate, Model) in one transaction; other rows are untouched.
    /// Each row's Cost comes from <paramref name="cost"/> over the items' model prices.
    /// </summary>
    Task UpsertAsync(AgentTokenUsageSubmitRequest request, CostFunction cost);

    Task<IEnumerable<AgentTokenUsageReportRow>> ReportAsync(AgentTokenUsageReportQuery query);
}

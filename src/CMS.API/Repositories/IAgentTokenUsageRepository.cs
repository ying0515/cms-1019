using CMS.API.Models;

namespace CMS.API.Repositories;

public interface IAgentTokenUsageRepository
{
    /// <summary>AppUser.IsActive for the user, or null when the user doesn't exist.</summary>
    Task<bool?> GetUserIsActiveAsync(string userId);

    /// <summary>Upserts every item on (SessionId, UsageDate, Model) in one transaction; other rows are untouched.</summary>
    Task UpsertAsync(AgentTokenUsageSubmitRequest request);

    Task<IEnumerable<AgentTokenUsageReportRow>> ReportAsync(AgentTokenUsageReportQuery query);
}

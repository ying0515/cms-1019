namespace CMS.API.Models;

/// <summary>Usage rows added up by user × date × project × model.</summary>
public class AgentTokenUsageReportRow
{
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public DateOnly UsageDate { get; set; }
    public string Project { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public long InputTokens { get; set; }
    public long OutputTokens { get; set; }
    public long CacheWriteTokens { get; set; }
    public long CacheReadTokens { get; set; }
    /// <summary>Sum of priced rows; null when no row in the group is priced.</summary>
    public decimal? Cost { get; set; }
    /// <summary>Usage rows in the group whose Cost is NULL.</summary>
    public int UnpricedCount { get; set; }
    public int SessionCount { get; set; }
}

namespace CMS.API.Models;

/// <summary>Token counts of one AgentTokenUsage row (or a submitted item about to become one); priced by CostCalculator.</summary>
public record UsageTokens(string Model, DateOnly UsageDate,
    long InputTokens, long OutputTokens, long CacheWriteTokens, long CacheReadTokens);

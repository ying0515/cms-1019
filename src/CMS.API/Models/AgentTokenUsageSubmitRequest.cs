using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

/// <summary>A session's absolute usage totals, split by Taipei date and model (POST /api/agent-token-usage).</summary>
public class AgentTokenUsageSubmitRequest
{
    [Required, StringLength(100)]
    public string SessionId { get; set; } = string.Empty;

    [Required, StringLength(200)]
    public string UserId { get; set; } = string.Empty;

    [Required, StringLength(200)]
    public string Project { get; set; } = string.Empty;

    [MinLength(1)]
    public List<AgentTokenUsageItem> Items { get; set; } = [];
}

public class AgentTokenUsageItem
{
    // Nullable so a missing date is a 400 instead of 0001-01-01
    [Required]
    public DateOnly? UsageDate { get; set; }

    [Required, StringLength(100)]
    public string Model { get; set; } = string.Empty;

    [Range(0, long.MaxValue)]
    public long InputTokens { get; set; }

    [Range(0, long.MaxValue)]
    public long OutputTokens { get; set; }

    [Range(0, long.MaxValue)]
    public long CacheWriteTokens { get; set; }

    [Range(0, long.MaxValue)]
    public long CacheReadTokens { get; set; }

    public UsageTokens ToUsageTokens()
        => new(Model, UsageDate!.Value, InputTokens, OutputTokens, CacheWriteTokens, CacheReadTokens);
}

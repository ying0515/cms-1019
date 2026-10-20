namespace CMS.API.Models;

/// <summary>Report filters (POST /api/agent-token-usage/report); dates are inclusive, blank strings mean "all".</summary>
public class AgentTokenUsageReportQuery
{
    public DateOnly? UsageDateFrom { get; set; }
    public DateOnly? UsageDateTo { get; set; }
    public string? UserId { get; set; }
    public string? Project { get; set; }
    public string? Model { get; set; }
}

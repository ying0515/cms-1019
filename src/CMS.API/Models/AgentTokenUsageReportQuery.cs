namespace CMS.API.Models;

/// <summary>Report filters (POST /api/agent-token-usage/report); dates are inclusive.</summary>
public class AgentTokenUsageReportQuery
{
    public DateOnly? UsageDateFrom { get; set; }
    public DateOnly? UsageDateTo { get; set; }
}

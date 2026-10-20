namespace CMS.API.Models;

/// <summary>One change in a record's history (GET /api/rowaudit). DateTime is UTC.</summary>
public class RowAuditEntry
{
    public DateTime DateTime { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string ActionType { get; set; } = string.Empty;
    public string? ActionDesc { get; set; }
}

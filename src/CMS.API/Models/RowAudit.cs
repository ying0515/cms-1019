namespace CMS.API.Models;

/// <summary>One RowAudit row: a single Insert / Update / Delete on a business table.</summary>
public class RowAudit
{
    public string TableName { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string PrimaryKeyValues { get; set; } = string.Empty;
    public string ActionType { get; set; } = string.Empty;
    public string? ActionDesc { get; set; }
    public DateTime DateTime { get; set; }
}

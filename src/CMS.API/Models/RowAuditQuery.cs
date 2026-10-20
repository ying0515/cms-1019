using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

/// <summary>Query string of GET /api/rowaudit: one record of one table.</summary>
public class RowAuditQuery
{
    [Required, StringLength(50)]
    public string TableName { get; set; } = string.Empty;

    /// <summary>Matched against RowAudit.PrimaryKeyValues, so string keys work too.</summary>
    [Required, StringLength(100)]
    public string Pkid { get; set; } = string.Empty;
}

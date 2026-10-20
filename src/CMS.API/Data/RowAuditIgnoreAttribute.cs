namespace CMS.API.Data;

/// <summary>Not a column of the audited table (e.g. a subquery count), so an Update never lists it as changed.</summary>
[AttributeUsage(AttributeTargets.Property)]
public sealed class RowAuditIgnoreAttribute : Attribute;

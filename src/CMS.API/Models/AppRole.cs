namespace CMS.API.Models;

public class AppRole
{
    public int Pkid { get; set; }
    public string RoleId { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
    public int PermissionLevel { get; set; }
    public string? Description { get; set; }
    // Subquery count of AppUserRole rows
    public int UserCount { get; set; }
    // Populated on GET by pkid:
    public List<AppUserLookup> Users { get; set; } = [];
}

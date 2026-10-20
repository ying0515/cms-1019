using CMS.API.Data;

namespace CMS.API.Models;

public class AppUser
{
    public int Pkid { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    // PasswordHash is never exposed; set on create / change-password / Admin reset (UTC)
    public DateTime? PasswordUpdatedTime { get; set; }
    // Subquery count of AppUserRole rows
    [RowAuditIgnore]
    public int RoleCount { get; set; }
    // Populated on GET by pkid:
    public List<AppRoleLookup> Roles { get; set; } = [];
}

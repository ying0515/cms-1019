namespace CMS.API.Models;

public class AppRoleQuery
{
    // LIKE on RoleId, RoleName, Description
    public string? Keyword { get; set; }
    public int? PermissionLevelFrom { get; set; }
    public int? PermissionLevelTo { get; set; }
    // Roles assigned to this AppUser.UserId
    public string? UserId { get; set; }
}

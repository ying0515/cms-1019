using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

public class AppRoleRequest
{
    public int Pkid { get; set; }

    [Required, StringLength(200)]
    public string RoleId { get; set; } = string.Empty;

    [Required, StringLength(200)]
    public string RoleName { get; set; } = string.Empty;

    public int PermissionLevel { get; set; } = 100;

    [StringLength(400)]
    public string? Description { get; set; }

    // n-n AppUserRole (keyed by AppUser.UserId)
    public List<string> UserIds { get; set; } = [];
}

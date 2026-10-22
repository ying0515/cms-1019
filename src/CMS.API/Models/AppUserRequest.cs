using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace CMS.API.Models;

/// <summary>Write DTO. Deliberately has no password field — PasswordHash is managed by the backend.</summary>
public class AppUserRequest
{
    [JsonRequired]
    public int Pkid { get; set; }

    [Required, StringLength(200)]
    public string UserId { get; set; } = string.Empty;

    [Required, StringLength(200)]
    public string UserName { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    // n-n AppUserRole (keyed by AppRole.RoleId)
    public List<string> RoleIds { get; set; } = [];
}

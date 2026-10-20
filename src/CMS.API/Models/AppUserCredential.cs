namespace CMS.API.Models;

/// <summary>Backend-only login lookup row. Carries PasswordHash, so it is never returned by any endpoint.</summary>
public class AppUserCredential
{
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public string PasswordHash { get; set; } = string.Empty;
    public List<string> RoleIds { get; set; } = [];
}

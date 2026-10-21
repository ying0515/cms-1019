namespace CMS.API.Models;

/// <summary>Backend-only login row. Holds PasswordHash, so it is never returned by an endpoint.</summary>
public class AppUserCredential
{
    public int Pkid { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public string PasswordHash { get; set; } = string.Empty;
    // UTC; part of the session stamp, so a password change or reset ends other sessions
    public DateTime? PasswordUpdatedTime { get; set; }
    public bool MustChangePassword { get; set; }
}

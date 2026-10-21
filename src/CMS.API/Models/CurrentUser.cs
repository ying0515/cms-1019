namespace CMS.API.Models;

/// <summary>Response of login and GET /api/auth/me: the signed-in user.</summary>
public class CurrentUser
{
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    // True until a default (created / reset) password is replaced; other APIs return 403 meanwhile
    public bool MustChangePassword { get; set; }
}

namespace CMS.API.Models;

/// <summary>User profile returned by POST /api/auth/login. Never carries PasswordHash.</summary>
public class LoginResponse
{
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string AccessToken { get; set; } = string.Empty;
}

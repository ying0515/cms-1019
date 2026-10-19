namespace CMS.API.Models;

public class AppUserLookup
{
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}

namespace CMS.API.Models;

public class AppUserQuery
{
    // LIKE on UserId, UserName
    public string? Keyword { get; set; }
    public bool? IsActive { get; set; }
    // Users assigned to this AppRole.RoleId
    public string? RoleId { get; set; }
}

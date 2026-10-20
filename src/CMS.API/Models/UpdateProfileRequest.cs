using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

/// <summary>PUT /api/auth/profile body. Only UserName: the user is taken from the JWT, and roles are not editable here.</summary>
public class UpdateProfileRequest
{
    // [Required] also rejects whitespace-only strings
    [Required(ErrorMessage = "請輸入使用者名稱"), StringLength(200, ErrorMessage = "使用者名稱最多 200 字")]
    public string UserName { get; set; } = string.Empty;
}

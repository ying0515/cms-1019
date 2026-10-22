using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

/// <summary>POST /api/auth/change-password</summary>
public class ChangePasswordRequest
{
    [Required(ErrorMessage = "請輸入目前密碼"), StringLength(128)]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required(ErrorMessage = "請輸入新密碼")]
    [StringLength(128, MinimumLength = 8, ErrorMessage = "新密碼須為 8 到 128 字")]
    public string NewPassword { get; set; } = string.Empty;
}

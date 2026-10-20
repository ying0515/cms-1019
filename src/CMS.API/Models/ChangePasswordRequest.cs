using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

/// <summary>POST /api/auth/change-password body. Plain passwords in, nothing out; no UserId (taken from the JWT).</summary>
public class ChangePasswordRequest
{
    [Required(ErrorMessage = "請輸入目前密碼")]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required(ErrorMessage = "請輸入新密碼")]
    public string NewPassword { get; set; } = string.Empty;

    [Required(ErrorMessage = "請再次輸入新密碼")]
    public string ConfirmPassword { get; set; } = string.Empty;
}

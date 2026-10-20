using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

/// <summary>POST /api/auth/reset-password body (Admin only): just the target user. No password in or out.</summary>
public class ResetPasswordRequest
{
    [Required(ErrorMessage = "請指定使用者帳號")]
    public string UserId { get; set; } = string.Empty;
}

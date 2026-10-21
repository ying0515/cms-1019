using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

/// <summary>POST /api/auth/login</summary>
public class LoginRequest
{
    [Required(ErrorMessage = "請輸入使用者帳號"), StringLength(200)]
    public string UserId { get; set; } = string.Empty;

    [Required(ErrorMessage = "請輸入密碼"), StringLength(128)]
    public string Password { get; set; } = string.Empty;
}

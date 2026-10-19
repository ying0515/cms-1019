using System.Security.Cryptography;
using System.Text;

namespace CMS.API.Data;

public static class PasswordHasher
{
    /// <summary>SHA-256 of the UTF-8 bytes, as 64 lowercase hex chars.</summary>
    public static string Sha256Hex(string password)
        => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(password)));
}

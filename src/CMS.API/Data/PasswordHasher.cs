using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;

namespace CMS.API.Data;

public enum PasswordCheck
{
    Failed,
    Success,
    /// <summary>Correct password, but the stored hash is legacy SHA-256 or an older PBKDF2 format.</summary>
    SuccessRehashNeeded,
}

public static class PasswordHasher
{
    private static readonly PasswordHasher<object> Pbkdf2 = new();
    private static readonly object User = new();

    /// <summary>Salted PBKDF2 hash (ASP.NET Core Identity v3 format) for PasswordHash.</summary>
    public static string Hash(string password) => Pbkdf2.HashPassword(User, password);

    /// <summary>Checks a password against a PBKDF2 hash or a legacy 64-char SHA-256 hex hash.</summary>
    public static PasswordCheck Verify(string storedHash, string password)
    {
        if (IsLegacySha256(storedHash))
        {
            var actual = Encoding.ASCII.GetBytes(Sha256Hex(password));
            var expected = Encoding.ASCII.GetBytes(storedHash.ToLowerInvariant());
            return CryptographicOperations.FixedTimeEquals(actual, expected)
                ? PasswordCheck.SuccessRehashNeeded
                : PasswordCheck.Failed;
        }

        try
        {
            return Pbkdf2.VerifyHashedPassword(User, storedHash, password) switch
            {
                PasswordVerificationResult.Success => PasswordCheck.Success,
                PasswordVerificationResult.SuccessRehashNeeded => PasswordCheck.SuccessRehashNeeded,
                _ => PasswordCheck.Failed,
            };
        }
        catch (FormatException)
        {
            // Not base64: neither format, so no password can match.
            return PasswordCheck.Failed;
        }
    }

    /// <summary>SHA-256 of the UTF-8 bytes, as 64 lowercase hex chars (legacy PasswordHash format).</summary>
    public static string Sha256Hex(string password)
        => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(password)));

    private static bool IsLegacySha256(string hash)
        => hash.Length == 64 && hash.All(Uri.IsHexDigit);
}

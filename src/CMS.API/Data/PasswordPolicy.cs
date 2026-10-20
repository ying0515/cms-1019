namespace CMS.API.Data;

/// <summary>New-password complexity rule (mirrored client-side in CMS.NG `password-policy.ts`).</summary>
public static class PasswordPolicy
{
    public const int MinLength = 8;
    public const int MinClasses = 3;

    public const string Message =
        "密碼長度至少需 8 碼，且內容須至少包含四種字元的其中三種：大寫英文／小寫英文／數字／符號"
        + " (Password must be at least 8 characters and contain at least 3 of the 4 classes: uppercase / lowercase / digit / symbol.)";

    /// <summary>
    /// Length ≥ 8 and at least 3 of: A–Z, a–z, 0–9, symbol (any other non-whitespace character).
    /// Length counts UTF-16 chars, same as JavaScript's <c>.length</c>.
    /// </summary>
    public static bool IsValid(string password)
    {
        if (password.Length < MinLength) return false;
        var classes = 0;
        if (password.Any(c => c is >= 'A' and <= 'Z')) classes++;
        if (password.Any(c => c is >= 'a' and <= 'z')) classes++;
        if (password.Any(c => c is >= '0' and <= '9')) classes++;
        if (password.Any(IsSymbol)) classes++;
        return classes >= MinClasses;
    }

    private static bool IsSymbol(char c)
        => c is not (>= 'A' and <= 'Z') and not (>= 'a' and <= 'z') and not (>= '0' and <= '9') && !char.IsWhiteSpace(c);
}

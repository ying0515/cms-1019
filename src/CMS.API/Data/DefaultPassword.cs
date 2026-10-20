using System.Text.Json;
using CMS.API.Repositories;

namespace CMS.API.Data;

/// <summary>The system default password: SysConfig[appConfig].defaultPassword, used for new users and Admin resets.</summary>
public static class DefaultPassword
{
    public const string MissingMessage = "系統設定 appConfig 未設定 defaultPassword";

    /// <summary>defaultPassword from the appConfig JSON, or null if missing, empty or malformed.</summary>
    public static string? FromAppConfig(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind == JsonValueKind.Object
                && doc.RootElement.TryGetProperty("defaultPassword", out var value)
                && value.ValueKind == JsonValueKind.String
                && value.GetString() is { Length: > 0 } password)
                return password;
        }
        catch (JsonException)
        {
            // Malformed appConfig is treated as "not configured".
        }
        return null;
    }

    /// <summary>SHA-256 of the current default password (read at call time), or null if not configured.</summary>
    public static async Task<string?> ReadHashAsync(ISysConfigRepository sysConfig)
        => FromAppConfig(await sysConfig.GetValueAsync(SigningKey.AppConfigKey)) is { } password
            ? PasswordHasher.Sha256Hex(password)
            : null;
}

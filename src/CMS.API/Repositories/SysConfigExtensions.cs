using System.Text.Json;

namespace CMS.API.Repositories;

public static class SysConfigExtensions
{
    private const string AppConfigKey = "appConfig";

    /// <summary>SysConfig[appConfig].defaultPassword, or null if it is not configured.</summary>
    public static async Task<string?> GetDefaultPasswordAsync(this ISysConfigRepository sysConfig)
    {
        var json = await sysConfig.GetValueAsync(AppConfigKey);
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
}

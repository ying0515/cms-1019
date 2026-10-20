using System.Text;
using System.Text.Json;
using CMS.API.Repositories;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace CMS.API.Data;

/// <summary>The JWT signing secret: SysConfig[appConfig].symmetricSecurityKey, used to issue and to validate tokens.</summary>
public static class SigningKey
{
    public const string AppConfigKey = "appConfig";

    /// <summary>symmetricSecurityKey from the appConfig JSON, or null if missing, malformed or too short for HS256.</summary>
    public static string? FromAppConfig(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind == JsonValueKind.Object
                && doc.RootElement.TryGetProperty("symmetricSecurityKey", out var value)
                && value.ValueKind == JsonValueKind.String
                && value.GetString() is { } secret
                && Encoding.UTF8.GetByteCount(secret) >= AccessTokenBuilder.MinKeyBytes)
                return secret;
        }
        catch (JsonException)
        {
            // Malformed appConfig is treated as "not configured".
        }
        return null;
    }

    public static async Task<string?> ReadAsync(ISysConfigRepository sysConfig)
        => FromAppConfig(await sysConfig.GetValueAsync(AppConfigKey));
}

/// <summary>
/// Feeds JwtBearer the signing key from SysConfig on every request (async, no restart needed after a key change).
/// JwtBearer adds <see cref="OpenIdConnectConfiguration.SigningKeys"/> to the validation keys; nothing else is used.
/// No key configured → no signing keys → every token is rejected (401).
/// </summary>
public class SysConfigSigningKeyManager(IServiceScopeFactory scopes) : IConfigurationManager<OpenIdConnectConfiguration>
{
    public async Task<OpenIdConnectConfiguration> GetConfigurationAsync(CancellationToken cancel)
    {
        using var scope = scopes.CreateScope();
        var secret = await SigningKey.ReadAsync(scope.ServiceProvider.GetRequiredService<ISysConfigRepository>());
        var config = new OpenIdConnectConfiguration();
        if (secret is not null) config.SigningKeys.Add(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)));
        return config;
    }

    // Nothing is cached, so there is nothing to refresh.
    public void RequestRefresh() { }
}

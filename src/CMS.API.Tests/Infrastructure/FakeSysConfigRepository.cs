using CMS.API.Repositories;

namespace CMS.API.Tests.Infrastructure;

/// <summary>In-memory ISysConfigRepository; tests can change or remove keys.</summary>
public class FakeSysConfigRepository : ISysConfigRepository
{
    public const string DefaultPassword = "P@ssw0rd!";

    public Dictionary<string, string> Values { get; } = new()
    {
        ["appConfig"] = $$"""{ "siteName": "CMS", "defaultPassword": "{{DefaultPassword}}" }""",
    };

    public Task<string?> GetValueAsync(string configKey)
        => Task.FromResult(Values.GetValueOrDefault(configKey));
}

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using CMS.API.Data;
using CMS.API.Models;
using CMS.API.Tests.Infrastructure;

namespace CMS.API.Tests;

/// <summary>Global JWT authorization: every endpoint needs a Bearer token except AuthController and the API-key ingest.</summary>
public class JwtAuthorizationTests : IDisposable
{
    private const string ProtectedUrl = "/api/app-roles";

    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client;

    public JwtAuthorizationTests()
    {
        _client = _factory.CreateClient();
        _client.DefaultRequestHeaders.Authorization = null; // each test chooses its own token
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    private Task<HttpResponseMessage> Send(HttpMethod method, string url, string? bearer, object? body = null)
    {
        var message = new HttpRequestMessage(method, url);
        if (body is not null) message.Content = JsonContent.Create(body);
        if (bearer is not null) message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
        return _client.SendAsync(message);
    }

    // ---- Protected endpoints ----

    public static TheoryData<string, string> ProtectedEndpoints => new()
    {
        { "GET", "/api/app-roles" },
        { "GET", "/api/app-users" },
        { "GET", "/api/courses" },
        { "GET", "/api/lookups/app-roles" },
        { "GET", "/api/model-prices" },
        { "POST", "/api/agent-token-usage/report" },
    };

    [Theory]
    [MemberData(nameof(ProtectedEndpoints))]
    public async Task ProtectedEndpoint_WithoutToken_Returns401(string method, string url)
    {
        var res = await Send(new HttpMethod(method), url, bearer: null, body: method == "POST" ? new { } : null);

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        Assert.Contains(res.Headers.WwwAuthenticate, h => h.Scheme == "Bearer");
    }

    [Theory]
    [MemberData(nameof(ProtectedEndpoints))]
    public async Task ProtectedEndpoint_WithValidToken_Returns200(string method, string url)
    {
        var res = await Send(new HttpMethod(method), url, CmsApiFactory.TokenFor(), method == "POST" ? new { } : null);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithTokenFromLogin_Returns200()
    {
        _factory.AppUsers.SetPassword("jenny", "Secret#123");
        var login = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest { UserId = "jenny", Password = "Secret#123" });
        var token = (await login.Content.ReadFromJsonAsync<LoginResponse>())!.AccessToken;

        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, ProtectedUrl, token)).StatusCode);
    }

    public static TheoryData<string> InvalidTokens => new()
    {
        "not-a-jwt",
        // signed with another key
        AccessTokenBuilder.Build("helen", "helen", ["Admin"], "some-other-signing-key-0123456789", DateTimeOffset.UtcNow),
        // expired: issued 25h ago, 24h lifetime
        AccessTokenBuilder.Build("helen", "helen", ["Admin"], FakeSysConfigRepository.SigningKey, DateTimeOffset.UtcNow.AddHours(-25)),
    };

    [Theory]
    [MemberData(nameof(InvalidTokens))]
    public async Task ProtectedEndpoint_WithInvalidToken_Returns401(string token)
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Get, ProtectedUrl, token)).StatusCode);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithBasicScheme_Returns401()
    {
        var message = new HttpRequestMessage(HttpMethod.Get, ProtectedUrl);
        message.Headers.Authorization = new AuthenticationHeaderValue("Basic", CmsApiFactory.TokenFor());

        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.SendAsync(message)).StatusCode);
    }

    // ---- Validation key is read from SysConfig at runtime ----

    [Fact]
    public async Task SigningKeyRotatedInSysConfig_OldTokenRejected_NewTokenAccepted()
    {
        var oldToken = CmsApiFactory.TokenFor();
        const string rotated = "rotated-signing-key-abcdefghijklmnop";
        _factory.SysConfig.Values["appConfig"] = $$"""{ "symmetricSecurityKey": "{{rotated}}" }""";
        var newToken = AccessTokenBuilder.Build("helen", "helen", ["Admin"], rotated, DateTimeOffset.UtcNow);

        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Get, ProtectedUrl, oldToken)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, ProtectedUrl, newToken)).StatusCode);
    }

    [Fact]
    public async Task SigningKeyMissingFromSysConfig_EveryTokenRejected()
    {
        _factory.SysConfig.Values.Remove("appConfig");

        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Get, ProtectedUrl, CmsApiFactory.TokenFor())).StatusCode);
    }

    // ---- Anonymous endpoints ----

    [Theory]
    [InlineData(null)]
    [InlineData("not-a-jwt")]
    public async Task AuthLogin_IsAnonymous_EvenWithMissingOrBadToken(string? bearer)
    {
        _factory.AppUsers.SetPassword("helen", "Secret#123");

        var ok = await Send(HttpMethod.Post, "/api/auth/login", bearer, new LoginRequest { UserId = "helen", Password = "Secret#123" });
        var wrong = await Send(HttpMethod.Post, "/api/auth/login", bearer, new LoginRequest { UserId = "helen", Password = "nope" });

        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        // 401 here is the credential check, not the JWT challenge
        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);
        Assert.Empty(wrong.Headers.WwwAuthenticate);
    }

    [Fact]
    public async Task AgentTokenUsageIngest_NeedsApiKeyNotJwt()
    {
        var body = new AgentTokenUsageSubmitRequest
        {
            SessionId = "s-1",
            UserId = "jenny",
            Project = "cms-1019",
            Items = [new AgentTokenUsageItem { UsageDate = new DateOnly(2026, 10, 20), Model = "claude-opus-5-5", InputTokens = 1 }],
        };

        var withKey = new HttpRequestMessage(HttpMethod.Post, "/api/agent-token-usage") { Content = JsonContent.Create(body) };
        withKey.Headers.Add("X-Api-Key", CmsApiFactory.ApiKey);

        Assert.Equal(HttpStatusCode.NoContent, (await _client.SendAsync(withKey)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Post, "/api/agent-token-usage", CmsApiFactory.TokenFor(), body)).StatusCode);
    }
}

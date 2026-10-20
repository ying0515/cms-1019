using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using CMS.API.Data;
using CMS.API.Models;
using CMS.API.Tests.Infrastructure;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace CMS.API.Tests;

public class AuthControllerTests : IDisposable
{
    private const string LoginUrl = "/api/auth/login";
    private const string Password = "Secret#123";

    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client;

    public AuthControllerTests()
    {
        _client = _factory.CreateClient();
        // Seeded: helen (active, Admin), jenny (active, Admin), miles (inactive, User)
        _factory.AppUsers.SetPassword("helen", Password);
        _factory.AppUsers.SetPassword("jenny", Password);
        _factory.AppUsers.SetPassword("miles", Password);
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    private Task<HttpResponseMessage> Login(string userId, string password)
        => _client.PostAsJsonAsync(LoginUrl, new LoginRequest { UserId = userId, Password = password });

    private static async Task<JsonWebToken> ReadValidatedToken(LoginResponse body)
    {
        var result = await new JsonWebTokenHandler().ValidateTokenAsync(body.AccessToken, new TokenValidationParameters
        {
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(FakeSysConfigRepository.SigningKey)),
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = false, // the test clock is pinned, not real time
        });
        Assert.True(result.IsValid, result.Exception?.Message);
        return (JsonWebToken)result.SecurityToken;
    }

    // ---- Success ----

    [Fact]
    public async Task Login_ActiveUser_ReturnsProfileWithSignedToken()
    {
        var res = await Login("jenny", Password);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(body);
        Assert.Equal("jenny", body.UserId);
        Assert.Equal("Jenny_Tsao", body.UserName);
        Assert.False(string.IsNullOrEmpty(body.AccessToken));

        var token = await ReadValidatedToken(body);
        Assert.Equal("HS256", token.Alg);
        Assert.Equal("jenny", token.GetClaim(AccessTokenBuilder.UserIdClaim).Value);
        Assert.Equal("Jenny_Tsao", token.GetClaim(AccessTokenBuilder.UserNameClaim).Value);
    }

    [Fact]
    public async Task Login_ResponseHasOnlyProfileFields_AndNoPasswordHash()
    {
        var res = await Login("helen", Password);
        var json = await res.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        using var doc = JsonDocument.Parse(json);
        Assert.Equal(["userId", "userName", "accessToken"], doc.RootElement.EnumerateObject().Select(p => p.Name));
        Assert.DoesNotContain("password", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(PasswordHasher.Sha256Hex(Password), json, StringComparison.OrdinalIgnoreCase);

        // ...nor inside the token payload
        var token = await ReadValidatedToken(JsonSerializer.Deserialize<LoginResponse>(json, JsonSerializerOptions.Web)!);
        Assert.DoesNotContain(token.Claims, c => c.Type.Contains("password", StringComparison.OrdinalIgnoreCase)
            || c.Value.Contains(PasswordHasher.Sha256Hex(Password), StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Login_TokenCarriesEveryRoleOfTheUser()
    {
        await _factory.AppUsers.UpdateAsync(new AppUserRequest
        {
            Pkid = 2, UserId = "jenny", UserName = "Jenny_Tsao", IsActive = true, RoleIds = ["Admin", "User"],
        });

        var body = await (await Login("jenny", Password)).Content.ReadFromJsonAsync<LoginResponse>();
        var token = await ReadValidatedToken(body!);

        Assert.Equal(["Admin", "User"],
            token.Claims.Where(c => c.Type == AccessTokenBuilder.RoleClaim).Select(c => c.Value).Order());
    }

    [Fact]
    public async Task Login_UserWithoutRoles_TokenHasNoRoleClaims()
    {
        await _factory.AppUsers.UpdateAsync(new AppUserRequest
        {
            Pkid = 1, UserId = "helen", UserName = "helen", IsActive = true, RoleIds = [],
        });

        var body = await (await Login("helen", Password)).Content.ReadFromJsonAsync<LoginResponse>();
        var token = await ReadValidatedToken(body!);

        Assert.DoesNotContain(token.Claims, c => c.Type == AccessTokenBuilder.RoleClaim);
    }

    [Fact]
    public async Task Login_TokenExpires24HoursAfterIssue()
    {
        var body = await (await Login("helen", Password)).Content.ReadFromJsonAsync<LoginResponse>();
        var token = await ReadValidatedToken(body!);

        var issuedAt = _factory.Clock.Now.UtcDateTime;
        Assert.Equal(issuedAt, token.IssuedAt);
        Assert.Equal(issuedAt.AddHours(24), token.ValidTo);
    }

    // ---- 401: same generic message whatever failed ----

    public static TheoryData<string, string> BadCredentials => new()
    {
        { "helen", "wrong-password" },   // wrong password
        { "helen", "" },                 // empty password
        { "nobody", Password },          // unknown UserId
        { "HELEN", Password },           // UserId must match exactly
        { "helen ", Password },          // ...including trailing spaces
        { "miles", Password },           // IsActive = 0, correct password
    };

    [Theory]
    [MemberData(nameof(BadCredentials))]
    public async Task Login_BadCredentials_Returns401_WithGenericMessage(string userId, string password)
    {
        var res = await Login(userId, password);

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Equal("帳號或密碼錯誤", body!["message"]);
        Assert.DoesNotContain("accessToken", await res.Content.ReadAsStringAsync());
    }

    // ---- Signing key comes from SysConfig at runtime ----

    [Fact]
    public async Task Login_UsesCurrentSysConfigSigningKey()
    {
        const string rotated = "rotated-signing-key-abcdefghijklmnop";
        _factory.SysConfig.Values["appConfig"] = $$"""{ "symmetricSecurityKey": "{{rotated}}" }""";

        var body = await (await Login("helen", Password)).Content.ReadFromJsonAsync<LoginResponse>();
        var result = await new JsonWebTokenHandler().ValidateTokenAsync(body!.AccessToken, new TokenValidationParameters
        {
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(rotated)),
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = false,
        });

        Assert.True(result.IsValid, result.Exception?.Message);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("not json")]
    [InlineData("""{ "siteName": "CMS" }""")]
    [InlineData("""{ "symmetricSecurityKey": "too-short" }""")]
    public async Task Login_SigningKeyNotConfigured_Returns500(string? appConfig)
    {
        if (appConfig is null) _factory.SysConfig.Values.Remove("appConfig");
        else _factory.SysConfig.Values["appConfig"] = appConfig;

        var res = await Login("helen", Password);

        Assert.Equal(HttpStatusCode.InternalServerError, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Contains("symmetricSecurityKey", body!["message"]);
    }
}

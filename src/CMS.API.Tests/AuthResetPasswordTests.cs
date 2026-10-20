using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using CMS.API.Data;
using CMS.API.Models;
using CMS.API.Tests.Infrastructure;

namespace CMS.API.Tests;

/// <summary>POST /api/auth/reset-password: Admin-only reset of a user's password to SysConfig appConfig defaultPassword.</summary>
public class AuthResetPasswordTests : IDisposable
{
    private const string Url = "/api/auth/reset-password";
    private const string JennyOldPassword = "Old#Pass1";

    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client; // default token: helen, role Admin

    public AuthResetPasswordTests()
    {
        _client = _factory.CreateClient();
        _factory.AppUsers.SetPassword("jenny", JennyOldPassword); // jenny = pkid 2
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    private Task<HttpResponseMessage> Reset(string userId, string? bearer = null)
    {
        var message = new HttpRequestMessage(HttpMethod.Post, Url) { Content = JsonContent.Create(new { userId }) };
        if (bearer is not null) message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
        return _client.SendAsync(message);
    }

    private async Task<DateTime?> JennyPasswordUpdatedTime()
        => (await _factory.AppUsers.GetByIdAsync(2))!.PasswordUpdatedTime;

    private void AssertJennyUnchanged()
        => Assert.Equal(PasswordHasher.Sha256Hex(JennyOldPassword), _factory.AppUsers.PasswordHashOf(2));

    // ---- Admin ----

    [Fact]
    public async Task Admin_SetsHashToSha256OfDefaultPassword_AndPasswordUpdatedTimeToNow()
    {
        var res = await Reset("jenny");

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
        Assert.Equal(PasswordHasher.Sha256Hex(FakeSysConfigRepository.DefaultPassword), _factory.AppUsers.PasswordHashOf(2));
        Assert.Equal(_factory.Clock.Now.UtcDateTime, await JennyPasswordUpdatedTime());
    }

    [Fact]
    public async Task Admin_ResponseCarriesNoPasswordOrHash()
    {
        var res = await Reset("jenny");
        var body = await res.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
        Assert.Equal(string.Empty, body);
        Assert.DoesNotContain(FakeSysConfigRepository.DefaultPassword, body);
        Assert.DoesNotContain(PasswordHasher.Sha256Hex(FakeSysConfigRepository.DefaultPassword), body);
    }

    [Fact]
    public async Task Admin_ReadsDefaultPasswordFromSysConfigAtRuntime()
    {
        const string changed = "Changed#Default9";
        _factory.SysConfig.Values["appConfig"] =
            $$"""{ "defaultPassword": "{{changed}}", "symmetricSecurityKey": "{{FakeSysConfigRepository.SigningKey}}" }""";

        await Reset("jenny");

        Assert.Equal(PasswordHasher.Sha256Hex(changed), _factory.AppUsers.PasswordHashOf(2));
    }

    [Fact]
    public async Task Admin_UserCanLogInWithTheDefaultPasswordAfterwards()
    {
        await Reset("jenny");

        var login = await _client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { UserId = "jenny", Password = FakeSysConfigRepository.DefaultPassword });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
    }

    [Fact]
    public async Task Admin_AmongSeveralRoles_IsAllowed()
    {
        var res = await Reset("jenny", CmsApiFactory.TokenFor("helen", "helen", "User", "Admin"));

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
    }

    [Fact]
    public async Task Admin_OnlyResetsTheTargetUser()
    {
        _factory.AppUsers.SetPassword("helen", "Helen#Pass1");

        await Reset("jenny");

        Assert.Equal(PasswordHasher.Sha256Hex("Helen#Pass1"), _factory.AppUsers.PasswordHashOf(1));
    }

    [Fact]
    public async Task Admin_UnknownUserId_Returns404()
    {
        Assert.Equal(HttpStatusCode.NotFound, (await Reset("nobody")).StatusCode);
    }

    [Fact]
    public async Task Admin_MissingUserId_Returns400()
    {
        Assert.Equal(HttpStatusCode.BadRequest, (await Reset("")).StatusCode);
        AssertJennyUnchanged();
    }

    [Fact]
    public async Task Admin_DefaultPasswordNotConfigured_Returns500_AndChangesNothing()
    {
        // keep the signing key, drop defaultPassword
        _factory.SysConfig.Values["appConfig"] = $$"""{ "symmetricSecurityKey": "{{FakeSysConfigRepository.SigningKey}}" }""";
        var timeBefore = await JennyPasswordUpdatedTime();

        var res = await Reset("jenny");

        Assert.Equal(HttpStatusCode.InternalServerError, res.StatusCode);
        Assert.Contains("defaultPassword", await res.Content.ReadAsStringAsync());
        AssertJennyUnchanged();
        Assert.Equal(timeBefore, await JennyPasswordUpdatedTime());
    }

    // ---- Not Admin ----

    [Theory]
    [InlineData("User")]
    [InlineData("Editor")]
    public async Task NonAdmin_Gets403_AndNothingChanges(string role)
    {
        var timeBefore = await JennyPasswordUpdatedTime();

        var res = await Reset("jenny", CmsApiFactory.TokenFor("miles", "Miles Sun", role));

        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
        AssertJennyUnchanged();
        Assert.Equal(timeBefore, await JennyPasswordUpdatedTime());
    }

    [Fact]
    public async Task NonAdmin_ResettingThemselves_Gets403()
    {
        var res = await Reset("miles", CmsApiFactory.TokenFor("miles", "Miles Sun", "User"));

        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Fact]
    public async Task NonAdmin_Gets403_EvenForABadBody()
    {
        // role check runs before model validation
        var res = await Reset("", CmsApiFactory.TokenFor("miles", "Miles Sun", "User"));

        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Fact]
    public async Task WithoutToken_Returns401()
    {
        _client.DefaultRequestHeaders.Authorization = null;

        Assert.Equal(HttpStatusCode.Unauthorized, (await Reset("jenny")).StatusCode);
        AssertJennyUnchanged();
    }

    // ---- Old endpoint is gone ----

    [Fact]
    public async Task OldAppUsersResetEndpoint_NoLongerExists()
    {
        var res = await _client.PostAsync("/api/app-users/2/reset-password", null);

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        AssertJennyUnchanged();
    }
}

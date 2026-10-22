using System.Net;
using System.Net.Http.Json;
using CMS.API.Auth;
using CMS.API.Data;
using CMS.API.Models;
using CMS.API.Tests.Infrastructure;

namespace CMS.API.Tests;

/// <summary>Real cookie sign-in: these clients send no X-Test-User header.</summary>
public class AuthControllerTests : IDisposable
{
    private const string Password = "Helen-pass-1";
    private const string NewPassword = "Helen-pass-2";

    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client;

    public AuthControllerTests()
    {
        _factory.AppUsers.SetPassword("helen", Password);
        _client = _factory.CreateAnonymousClient();
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    // ---- Every API requires sign-in ----

    [Theory]
    [InlineData("/api/app-users")]
    [InlineData("/api/app-roles")]
    [InlineData("/api/courses")]
    [InlineData("/api/lookups/app-users")]
    [InlineData("/api/auth/me")]
    public async Task Get_Anonymous_Returns401(string url)
    {
        var response = await _client.GetAsync(url);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Writes_Anonymous_Return401_AndChangeNothing()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.PostAsync("/api/app-users/2/reset-password", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.DeleteAsync("/api/app-users/2")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.PostAsJsonAsync("/api/app-users",
            new AppUserRequest { UserId = "eve", UserName = "Eve" })).StatusCode);

        Assert.NotNull(_factory.AppUsers.PasswordHashOf(2));
        Assert.False(await _factory.AppUsers.UserIdExistsAsync("eve"));
    }

    // ---- Login ----

    [Fact]
    public async Task Login_Valid_SetsHttpOnlyCookie_AndOpensTheApi()
    {
        var response = await Login("  helen  ", Password);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var user = await response.Content.ReadFromJsonAsync<CurrentUser>();
        Assert.Equal("helen", user!.UserId);
        Assert.False(user.MustChangePassword);

        var cookie = Assert.Single(response.Headers.GetValues("Set-Cookie"));
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=strict", cookie, StringComparison.OrdinalIgnoreCase);

        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync("/api/app-users")).StatusCode);
        Assert.Equal("helen", (await _client.GetFromJsonAsync<CurrentUser>("/api/auth/me"))!.UserId);
    }

    [Theory]
    [InlineData("helen", "wrong-password")]
    [InlineData("nobody", Password)]
    [InlineData("jenny", "seed-hash")]
    public async Task Login_BadCredentials_Returns401_WithSameMessage(string userId, string password)
    {
        var response = await Login(userId, password);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Equal("帳號或密碼錯誤", body!["message"]);
        Assert.False(response.Headers.Contains("Set-Cookie"));
    }

    [Fact]
    public async Task Login_InactiveUser_Returns401()
    {
        _factory.AppUsers.SetPassword("miles", Password); // seeded inactive

        Assert.Equal(HttpStatusCode.Unauthorized, (await Login("miles", Password)).StatusCode);
    }

    [Fact]
    public async Task Login_MissingFields_Returns400()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/login", new { userId = "helen" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Login_LegacySha256Hash_IsUpgradedToPbkdf2()
    {
        _factory.AppUsers.SetPassword("helen", Password, hash: PasswordHasher.Sha256Hex(Password));

        Assert.Equal(HttpStatusCode.OK, (await Login("helen", Password)).StatusCode);

        var hash = _factory.AppUsers.PasswordHashOf(1)!;
        Assert.NotEqual(PasswordHasher.Sha256Hex(Password), hash);
        Assert.Equal(PasswordCheck.Success, PasswordHasher.Verify(hash, Password));
        // Rehash keeps the session stamp, so the cookie just issued stays valid
        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync("/api/app-users")).StatusCode);
    }

    // ---- Forced password change ----

    [Fact]
    public async Task Login_MustChangePassword_OnlyAllowsMeAndChangePassword()
    {
        _factory.AppUsers.SetPassword("helen", Password, mustChangePassword: true);

        var user = await (await Login("helen", Password)).Content.ReadFromJsonAsync<CurrentUser>();

        Assert.True(user!.MustChangePassword);
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.GetAsync("/api/app-users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.PostAsync("/api/app-users/2/reset-password", null)).StatusCode);
        Assert.True((await _client.GetFromJsonAsync<CurrentUser>("/api/auth/me"))!.MustChangePassword);
    }

    [Fact]
    public async Task Login_WithDefaultPassword_MustChange_EvenWithoutFlag()
    {
        _factory.AppUsers.SetPassword("helen", FakeSysConfigRepository.DefaultPassword);

        var user = await (await Login("helen", FakeSysConfigRepository.DefaultPassword)).Content.ReadFromJsonAsync<CurrentUser>();

        Assert.True(user!.MustChangePassword);
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.GetAsync("/api/courses")).StatusCode);
    }

    [Fact]
    public async Task ChangePassword_Valid_ClearsFlag_AndOpensTheApi()
    {
        _factory.AppUsers.SetPassword("helen", Password, mustChangePassword: true);
        await Login("helen", Password);

        var response = await ChangePassword(Password, NewPassword);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False((await response.Content.ReadFromJsonAsync<CurrentUser>())!.MustChangePassword);
        Assert.False(_factory.AppUsers.MustChangePasswordOf(1));
        Assert.Equal(PasswordCheck.Success, PasswordHasher.Verify(_factory.AppUsers.PasswordHashOf(1)!, NewPassword));
        // Same client: the re-issued cookie carries the new stamp
        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync("/api/app-users")).StatusCode);
    }

    [Theory]
    [InlineData("wrong-current", NewPassword, "目前密碼不正確")]
    [InlineData(Password, Password, "新密碼不可與目前密碼相同")]
    [InlineData(Password, FakeSysConfigRepository.DefaultPassword, "新密碼不可為系統預設密碼")]
    [InlineData(Password, "short", "新密碼須為 8 到 128 字")]
    public async Task ChangePassword_Invalid_Returns400_AndKeepsPassword(string current, string next, string message)
    {
        await Login("helen", Password);

        var response = await ChangePassword(current, next);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(message, await response.Content.ReadAsStringAsync());
        Assert.Equal(PasswordCheck.Success, PasswordHasher.Verify(_factory.AppUsers.PasswordHashOf(1)!, Password));
    }

    [Fact]
    public async Task ChangePassword_Anonymous_Returns401()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await ChangePassword(Password, NewPassword)).StatusCode);
    }

    // ---- Session lifetime ----

    [Fact]
    public async Task Logout_EndsTheSession()
    {
        await Login("helen", Password);

        Assert.Equal(HttpStatusCode.NoContent, (await _client.PostAsync("/api/auth/logout", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync("/api/app-users")).StatusCode);
    }

    [Fact]
    public async Task PasswordChangedElsewhere_EndsOtherSessions()
    {
        using var other = _factory.CreateAnonymousClient();
        await Login("helen", Password);
        await other.PostAsJsonAsync("/api/auth/login", new LoginRequest { UserId = "helen", Password = Password });

        Assert.Equal(HttpStatusCode.OK, (await ChangePassword(Password, NewPassword)).StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await other.GetAsync("/api/app-users")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync("/api/app-users")).StatusCode);
    }

    [Fact]
    public async Task DeactivatedUser_LosesTheSession()
    {
        await Login("helen", Password);

        _factory.AppUsers.SetActive("helen", false);

        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync("/api/app-users")).StatusCode);
    }

    // ---- Admin role ----

    [Fact]
    public async Task Me_ReportsIsAdmin()
    {
        var user = await (await Login("helen", Password)).Content.ReadFromJsonAsync<CurrentUser>();

        Assert.True(user!.IsAdmin);
        Assert.True((await _client.GetFromJsonAsync<CurrentUser>("/api/auth/me"))!.IsAdmin);
    }

    [Fact]
    public async Task AdminRoleRemoved_AppliesToTheOpenSession()
    {
        await Login("helen", Password);

        _factory.AppUsers.SetRoles("helen", ["User"]);

        Assert.Equal(HttpStatusCode.Forbidden, (await _client.GetAsync("/api/app-users")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync("/api/courses")).StatusCode);
        Assert.False((await _client.GetFromJsonAsync<CurrentUser>("/api/auth/me"))!.IsAdmin);
    }

    // ---- Login throttling ----

    [Fact]
    public async Task Login_LockedOutAfterRepeatedFailures_EvenWithTheRightPassword()
    {
        for (var i = 0; i < LoginThrottle.MaxFailures; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await Login("helen", "wrong-password")).StatusCode);

        var locked = await Login("HELEN", Password);

        Assert.Equal(HttpStatusCode.TooManyRequests, locked.StatusCode);
        Assert.Contains(CmsAuth.TooManyAttempts, await locked.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync("/api/auth/me")).StatusCode);

        _factory.Clock.Advance(LoginThrottle.Window);
        Assert.Equal(HttpStatusCode.OK, (await Login("helen", Password)).StatusCode);
    }

    [Fact]
    public async Task Login_UnknownUser_LocksOutTheSameWay()
    {
        for (var i = 0; i < LoginThrottle.MaxFailures; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await Login("nobody", "wrong-password")).StatusCode);

        Assert.Equal(HttpStatusCode.TooManyRequests, (await Login("nobody", "wrong-password")).StatusCode);
    }

    [Fact]
    public async Task Login_Success_ClearsEarlierFailures()
    {
        for (var i = 0; i < LoginThrottle.MaxFailures - 1; i++)
            await Login("helen", "wrong-password");
        Assert.Equal(HttpStatusCode.OK, (await Login("helen", Password)).StatusCode);

        for (var i = 0; i < LoginThrottle.MaxFailures - 1; i++)
            await Login("helen", "wrong-password");
        Assert.Equal(HttpStatusCode.OK, (await Login("helen", Password)).StatusCode);
    }

    [Fact]
    public async Task Login_TooManyAttemptsFromOneClient_Returns429()
    {
        // Different UserIds, so only the per-IP limit applies.
        for (var i = 0; i < CmsAuth.LoginsPerMinutePerIp; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await Login($"guess{i}", "wrong-password")).StatusCode);

        var limited = await Login("helen", Password);

        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
        Assert.Contains(CmsAuth.TooManyAttempts, await limited.Content.ReadAsStringAsync());
    }

    private Task<HttpResponseMessage> Login(string userId, string password)
        => _client.PostAsJsonAsync("/api/auth/login", new LoginRequest { UserId = userId, Password = password });

    private Task<HttpResponseMessage> ChangePassword(string current, string next)
        => _client.PostAsJsonAsync("/api/auth/change-password",
            new ChangePasswordRequest { CurrentPassword = current, NewPassword = next });
}

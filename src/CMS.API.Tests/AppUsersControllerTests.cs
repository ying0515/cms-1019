using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CMS.API.Data;
using CMS.API.Models;
using CMS.API.Tests.Infrastructure;

namespace CMS.API.Tests;

public class AppUsersControllerTests : IDisposable
{
    private const string BaseUrl = "/api/app-users";

    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client;

    public AppUsersControllerTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    // ---- List ----

    [Fact]
    public async Task GetAll_ReturnsAllUsers_SortedByUserId()
    {
        var items = await _client.GetFromJsonAsync<List<AppUser>>(BaseUrl);

        Assert.NotNull(items);
        Assert.Equal(["helen", "jenny", "miles"], items.Select(u => u.UserId));
        Assert.Equal(1, items[0].RoleCount);
    }

    [Fact]
    public async Task GetAll_NeverExposesPasswordHash()
    {
        var json = await _client.GetStringAsync(BaseUrl);

        Assert.DoesNotContain("password", json.Replace("passwordUpdatedTime", ""), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Query_ByKeyword_MatchesUserIdOrUserName()
    {
        Assert.Equal("jenny", Assert.Single(await PostQuery(new AppUserQuery { Keyword = " tsao " })).UserId);
        Assert.Equal("miles", Assert.Single(await PostQuery(new AppUserQuery { Keyword = "MIL" })).UserId);
    }

    [Fact]
    public async Task Query_ByIsActive_FiltersUsers()
    {
        Assert.Equal("miles", Assert.Single(await PostQuery(new AppUserQuery { IsActive = false })).UserId);
        Assert.Equal(2, (await PostQuery(new AppUserQuery { IsActive = true })).Count);
    }

    [Fact]
    public async Task Query_ByRoleId_ReturnsUsersInRole()
    {
        var items = await PostQuery(new AppUserQuery { RoleId = "Admin" });

        Assert.Equal(["helen", "jenny"], items.Select(u => u.UserId));
    }

    [Fact]
    public async Task Query_NoMatch_ReturnsEmpty()
    {
        Assert.Empty(await PostQuery(new AppUserQuery { Keyword = "helen", RoleId = "User" }));
    }

    // ---- View ----

    [Fact]
    public async Task GetById_Existing_ReturnsUserWithRoles()
    {
        var item = await _client.GetFromJsonAsync<AppUser>($"{BaseUrl}/2");

        Assert.NotNull(item);
        Assert.Equal("Jenny_Tsao", item.UserName);
        Assert.Equal("Administrator", Assert.Single(item.Roles).RoleName);
    }

    [Fact]
    public async Task GetById_Missing_Returns404()
    {
        var response = await _client.GetAsync($"{BaseUrl}/99");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ---- Add ----

    [Fact]
    public async Task Create_Valid_Returns201_WithDefaultPasswordHash()
    {
        var request = new AppUserRequest { UserId = "  amy  ", UserName = " Amy Lin ", IsActive = true, RoleIds = ["User", "Admin"] };

        var response = await _client.PostAsJsonAsync(BaseUrl, request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<AppUser>();
        Assert.NotNull(created);
        Assert.Equal("amy", created.UserId); // trimmed
        Assert.Equal("Amy Lin", created.UserName);
        Assert.Equal(["Admin", "User"], created.Roles.Select(r => r.RoleId));
        Assert.NotNull(created.PasswordUpdatedTime);
        Assert.Equal($"/api/app-users/{created.Pkid}", response.Headers.Location?.AbsolutePath, ignoreCase: true);

        Assert.Equal(PasswordHasher.Sha256Hex(FakeSysConfigRepository.DefaultPassword), _factory.AppUsers.PasswordHashOf(created.Pkid));
    }

    [Fact]
    public async Task Create_IgnoresPasswordHashInBody()
    {
        var response = await _client.PostAsJsonAsync(BaseUrl,
            new { userId = "eve", userName = "Eve", isActive = true, passwordHash = "attacker-chosen" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<AppUser>();
        Assert.Equal(PasswordHasher.Sha256Hex(FakeSysConfigRepository.DefaultPassword), _factory.AppUsers.PasswordHashOf(created!.Pkid));
    }

    [Fact]
    public async Task Create_DuplicateUserId_Returns409()
    {
        var response = await _client.PostAsJsonAsync(BaseUrl, new AppUserRequest { UserId = "HELEN", UserName = "Dup" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Theory]
    [InlineData("", "Name")]
    [InlineData("id", "")]
    public async Task Create_MissingRequired_Returns400(string userId, string userName)
    {
        var response = await _client.PostAsJsonAsync(BaseUrl, new AppUserRequest { UserId = userId, UserName = userName });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_UserIdTooLong_Returns400()
    {
        var response = await _client.PostAsJsonAsync(BaseUrl,
            new AppUserRequest { UserId = new string('x', 201), UserName = "Long" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_UnknownRole_Returns400()
    {
        var response = await _client.PostAsJsonAsync(BaseUrl,
            new AppUserRequest { UserId = "bob", UserName = "Bob", RoleIds = ["Nope"] });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // appConfig keeps symmetricSecurityKey: without it the JWT is rejected (401) before the controller runs.
    private void SetAppConfigWithoutDefaultPassword(string extraProperties = "")
        => _factory.SysConfig.Values["appConfig"] =
            $$"""{ "siteName": "CMS", "symmetricSecurityKey": "{{FakeSysConfigRepository.SigningKey}}"{{extraProperties}} }""";

    [Theory]
    [InlineData("")]
    [InlineData(""", "defaultPassword": "" """)]
    [InlineData(""", "defaultPassword": null """)]
    public async Task Create_DefaultPasswordNotConfigured_Returns500_AndDoesNotCreate(string extraProperties)
    {
        SetAppConfigWithoutDefaultPassword(extraProperties);

        var response = await _client.PostAsJsonAsync(BaseUrl, new AppUserRequest { UserId = "bob", UserName = "Bob" });

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Contains("defaultPassword", body!["message"]);
        Assert.Equal(3, (await _client.GetFromJsonAsync<List<AppUser>>(BaseUrl))!.Count);
    }

    // ---- Edit ----

    [Fact]
    public async Task Update_Existing_Returns204_AndKeepsPasswordHash()
    {
        var response = await _client.PutAsJsonAsync(BaseUrl,
            new AppUserRequest { Pkid = 3, UserId = "ignored", UserName = "Miles S.", IsActive = true, RoleIds = ["Admin", "User"] });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var fetched = await _client.GetFromJsonAsync<AppUser>($"{BaseUrl}/3");
        Assert.NotNull(fetched);
        Assert.Equal("miles", fetched.UserId); // UserId is immutable
        Assert.Equal("Miles S.", fetched.UserName);
        Assert.True(fetched.IsActive);
        Assert.Equal(2, fetched.Roles.Count);
        Assert.Equal("seed-hash", _factory.AppUsers.PasswordHashOf(3));
    }

    [Fact]
    public async Task Update_Missing_Returns404()
    {
        var response = await _client.PutAsJsonAsync(BaseUrl, new AppUserRequest { Pkid = 99, UserId = "x", UserName = "Nope" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Update_MissingUserName_Returns400()
    {
        var response = await _client.PutAsJsonAsync(BaseUrl, new AppUserRequest { Pkid = 1, UserId = "helen", UserName = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // Password reset moved to POST /api/auth/reset-password (Admin only): see AuthResetPasswordTests.

    // ---- Delete ----

    [Fact]
    public async Task Delete_Existing_Returns204_ThenNotFound()
    {
        var response = await _client.DeleteAsync($"{BaseUrl}/3");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var after = await _client.GetAsync($"{BaseUrl}/3");
        Assert.Equal(HttpStatusCode.NotFound, after.StatusCode);
    }

    [Fact]
    public async Task Delete_Missing_Returns404()
    {
        var response = await _client.DeleteAsync($"{BaseUrl}/99");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ---- Lookup ----

    [Fact]
    public async Task LookupAppRoles_ReturnsRoleIdAndName_SortedByRoleId()
    {
        var items = await _client.GetFromJsonAsync<List<AppRoleLookup>>("/api/lookups/app-roles");

        Assert.NotNull(items);
        Assert.Equal(["Admin", "User"], items.Select(r => r.RoleId));
        Assert.Equal("Administrator", items[0].RoleName);
    }

    private async Task<List<AppUser>> PostQuery(AppUserQuery query)
    {
        var response = await _client.PostAsJsonAsync($"{BaseUrl}/query", query);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<List<AppUser>>())!;
    }
}

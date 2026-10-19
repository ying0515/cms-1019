using System.Net;
using System.Net.Http.Json;
using CMS.API.Models;
using CMS.API.Tests.Infrastructure;

namespace CMS.API.Tests;

public class AppRolesControllerTests : IDisposable
{
    private const string BaseUrl = "/api/app-roles";

    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client;

    public AppRolesControllerTests()
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
    public async Task GetAll_ReturnsAllRoles_SortedByRoleId_WithUserCount()
    {
        var roles = await _client.GetFromJsonAsync<List<AppRole>>(BaseUrl);

        Assert.NotNull(roles);
        Assert.Equal(["Admin", "User"], roles.Select(r => r.RoleId));
        Assert.Equal(2, roles.Single(r => r.RoleId == "Admin").UserCount);
        Assert.Equal(1, roles.Single(r => r.RoleId == "User").UserCount);
    }

    [Fact]
    public async Task Query_EmptyFilter_ReturnsAll()
    {
        var roles = await PostQuery(new AppRoleQuery());

        Assert.Equal(2, roles.Count);
    }

    [Theory]
    [InlineData("admin", "Admin")]    // RoleId / RoleName
    [InlineData("一般", "User")]       // Description
    public async Task Query_ByKeyword_MatchesRoleIdNameOrDescription(string keyword, string expectedRoleId)
    {
        var roles = await PostQuery(new AppRoleQuery { Keyword = keyword });

        var role = Assert.Single(roles);
        Assert.Equal(expectedRoleId, role.RoleId);
    }

    [Fact]
    public async Task Query_ByPermissionLevelRange_FiltersRoles()
    {
        var roles = await PostQuery(new AppRoleQuery { PermissionLevelFrom = 50, PermissionLevelTo = 200 });

        Assert.Equal("User", Assert.Single(roles).RoleId);
    }

    [Fact]
    public async Task Query_ByUserId_ReturnsRolesAssignedToUser()
    {
        var roles = await PostQuery(new AppRoleQuery { UserId = "miles" });

        Assert.Equal("User", Assert.Single(roles).RoleId);
    }

    [Fact]
    public async Task Query_NoMatch_ReturnsEmpty()
    {
        var roles = await PostQuery(new AppRoleQuery { Keyword = "zzz-no-such-role" });

        Assert.Empty(roles);
    }

    // ---- View ----

    [Fact]
    public async Task GetById_Existing_ReturnsRoleWithUsers()
    {
        var role = await _client.GetFromJsonAsync<AppRole>($"{BaseUrl}/1");

        Assert.NotNull(role);
        Assert.Equal("Admin", role.RoleId);
        Assert.Equal("Administrator", role.RoleName);
        Assert.Equal(1, role.PermissionLevel);
        Assert.Equal(["helen", "jenny"], role.Users.Select(u => u.UserId).Order());
    }

    [Fact]
    public async Task GetById_Missing_Returns404()
    {
        var response = await _client.GetAsync($"{BaseUrl}/999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ---- Add ----

    [Fact]
    public async Task Create_Valid_Returns201_AndPersists()
    {
        var request = new AppRoleRequest
        {
            RoleId = "  Editor  ",
            RoleName = "Content Editor",
            PermissionLevel = 50,
            Description = "內容編輯",
            UserIds = ["helen", "miles"],
        };

        var response = await _client.PostAsJsonAsync(BaseUrl, request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<AppRole>();
        Assert.NotNull(created);
        Assert.True(created.Pkid > 0);
        Assert.Equal("Editor", created.RoleId); // trimmed
        Assert.Equal($"/api/app-roles/{created.Pkid}", response.Headers.Location?.AbsolutePath, ignoreCase: true);

        var fetched = await _client.GetFromJsonAsync<AppRole>($"{BaseUrl}/{created.Pkid}");
        Assert.NotNull(fetched);
        Assert.Equal("Content Editor", fetched.RoleName);
        Assert.Equal(2, fetched.UserCount);
    }

    [Fact]
    public async Task Create_DuplicateRoleId_Returns409()
    {
        var response = await _client.PostAsJsonAsync(BaseUrl,
            new AppRoleRequest { RoleId = "Admin", RoleName = "Dup", PermissionLevel = 1 });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Theory]
    [InlineData("", "Name")]
    [InlineData("Id", "")]
    public async Task Create_MissingRequiredFields_Returns400(string roleId, string roleName)
    {
        var response = await _client.PostAsJsonAsync(BaseUrl,
            new AppRoleRequest { RoleId = roleId, RoleName = roleName, PermissionLevel = 1 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_RoleIdTooLong_Returns400()
    {
        var response = await _client.PostAsJsonAsync(BaseUrl,
            new AppRoleRequest { RoleId = new string('x', 201), RoleName = "Long", PermissionLevel = 1 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ---- Edit ----

    [Fact]
    public async Task Update_Existing_Returns204_AndAppliesChanges()
    {
        var request = new AppRoleRequest
        {
            Pkid = 2,
            RoleId = "User",
            RoleName = "General User",
            PermissionLevel = 90,
            Description = null,
            UserIds = ["helen", "jenny", "miles"],
        };

        var response = await _client.PutAsJsonAsync(BaseUrl, request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var fetched = await _client.GetFromJsonAsync<AppRole>($"{BaseUrl}/2");
        Assert.NotNull(fetched);
        Assert.Equal("General User", fetched.RoleName);
        Assert.Equal(90, fetched.PermissionLevel);
        Assert.Null(fetched.Description);
        Assert.Equal(3, fetched.Users.Count);
    }

    [Fact]
    public async Task Update_ClearsUsers_WhenEmptyList()
    {
        var response = await _client.PutAsJsonAsync(BaseUrl,
            new AppRoleRequest { Pkid = 1, RoleId = "Admin", RoleName = "Administrator", PermissionLevel = 1, UserIds = [] });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var fetched = await _client.GetFromJsonAsync<AppRole>($"{BaseUrl}/1");
        Assert.Empty(fetched!.Users);
    }

    [Fact]
    public async Task Update_Missing_Returns404()
    {
        var response = await _client.PutAsJsonAsync(BaseUrl,
            new AppRoleRequest { Pkid = 999, RoleId = "Nope", RoleName = "Nope", PermissionLevel = 1 });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Update_MissingRoleName_Returns400()
    {
        var response = await _client.PutAsJsonAsync(BaseUrl,
            new AppRoleRequest { Pkid = 1, RoleId = "Admin", RoleName = "", PermissionLevel = 1 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ---- Delete ----

    [Fact]
    public async Task Delete_Existing_Returns204_ThenNotFound()
    {
        var response = await _client.DeleteAsync($"{BaseUrl}/2");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var after = await _client.GetAsync($"{BaseUrl}/2");
        Assert.Equal(HttpStatusCode.NotFound, after.StatusCode);
    }

    [Fact]
    public async Task Delete_Missing_Returns404()
    {
        var response = await _client.DeleteAsync($"{BaseUrl}/999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ---- CORS ----

    [Fact]
    public async Task Cors_AllowsLocalhostOrigin()
    {
        using var request = new HttpRequestMessage(HttpMethod.Options, BaseUrl);
        request.Headers.Add("Origin", "http://localhost:4200");
        request.Headers.Add("Access-Control-Request-Method", "PUT");

        var response = await _client.SendAsync(request);

        Assert.True(response.Headers.TryGetValues("Access-Control-Allow-Origin", out var values));
        Assert.Equal("http://localhost:4200", Assert.Single(values));
    }

    [Fact]
    public async Task Cors_RejectsNonLocalOrigin()
    {
        using var request = new HttpRequestMessage(HttpMethod.Options, BaseUrl);
        request.Headers.Add("Origin", "https://evil.example.com");
        request.Headers.Add("Access-Control-Request-Method", "PUT");

        var response = await _client.SendAsync(request);

        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
    }

    private async Task<List<AppRole>> PostQuery(AppRoleQuery query)
    {
        var response = await _client.PostAsJsonAsync($"{BaseUrl}/query", query);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<List<AppRole>>())!;
    }
}

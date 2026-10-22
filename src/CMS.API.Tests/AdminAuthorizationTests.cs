using System.Net;
using System.Net.Http.Json;
using CMS.API.Models;
using CMS.API.Tests.Infrastructure;

namespace CMS.API.Tests;

/// <summary>User and role management needs the Admin role ("helen" has it, "miles" does not).</summary>
public class AdminAuthorizationTests : IDisposable
{
    private const int HelenPkid = 1;
    private const int JennyPkid = 2;
    private const int AdminRolePkid = 1;

    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _admin;
    private readonly HttpClient _user;

    public AdminAuthorizationTests()
    {
        _admin = _factory.CreateClient();
        _user = _factory.CreateClientAs("miles");
    }

    public void Dispose()
    {
        _admin.Dispose();
        _user.Dispose();
        _factory.Dispose();
    }

    // ---- Non-admin ----

    [Theory]
    [InlineData("/api/app-users")]
    [InlineData("/api/app-users/1")]
    [InlineData("/api/app-roles")]
    [InlineData("/api/lookups/app-users")]
    [InlineData("/api/lookups/app-roles")]
    public async Task Get_NonAdmin_Returns403(string url)
    {
        Assert.Equal(HttpStatusCode.Forbidden, (await _user.GetAsync(url)).StatusCode);
    }

    [Theory]
    [InlineData("/api/courses")]
    [InlineData("/api/publish-statuses")]
    [InlineData("/api/lookups/partners")]
    public async Task Get_NonAdmin_StillReachesContent(string url)
    {
        Assert.Equal(HttpStatusCode.OK, (await _user.GetAsync(url)).StatusCode);
    }

    [Fact]
    public async Task Writes_NonAdmin_Return403_AndChangeNothing()
    {
        var hashBefore = _factory.AppUsers.PasswordHashOf(HelenPkid);

        Assert.Equal(HttpStatusCode.Forbidden,
            (await _user.PostAsync($"/api/app-users/{HelenPkid}/reset-password", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _user.PostAsJsonAsync("/api/app-users",
            new AppUserRequest { UserId = "eve", UserName = "Eve", RoleIds = ["Admin"] })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _user.PutAsJsonAsync("/api/app-roles",
            new AppRoleRequest { Pkid = AdminRolePkid, RoleId = "Admin", RoleName = "Administrator", UserIds = ["miles"] })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _user.DeleteAsync($"/api/app-users/{JennyPkid}")).StatusCode);

        Assert.Equal(hashBefore, _factory.AppUsers.PasswordHashOf(HelenPkid));
        Assert.False(await _factory.AppUsers.UserIdExistsAsync("eve"));
        Assert.NotNull(_factory.AppUsers.PasswordHashOf(JennyPkid));
    }

    // ---- An admin cannot lock the back office out ----

    [Theory]
    [InlineData(false, "Admin")]
    [InlineData(true, "User")]
    public async Task UpdateSelf_DroppingAdminOrDeactivating_Returns400(bool isActive, string roleId)
    {
        var response = await _admin.PutAsJsonAsync("/api/app-users", new AppUserRequest
        {
            Pkid = HelenPkid, UserId = "helen", UserName = "helen", IsActive = isActive, RoleIds = [roleId],
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("不可移除自己的管理員角色", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task UpdateOtherAdmin_DroppingAdmin_IsAllowed()
    {
        var response = await _admin.PutAsJsonAsync("/api/app-users", new AppUserRequest
        {
            Pkid = JennyPkid, UserId = "jenny", UserName = "Jenny_Tsao", IsActive = true, RoleIds = ["User"],
        });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task DeleteSelf_Returns400()
    {
        var response = await _admin.DeleteAsync($"/api/app-users/{HelenPkid}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.NotNull(_factory.AppUsers.PasswordHashOf(HelenPkid));
    }

    [Fact]
    public async Task UpdateAdminRole_WithoutSelf_Returns400()
    {
        var response = await _admin.PutAsJsonAsync("/api/app-roles", new AppRoleRequest
        {
            Pkid = AdminRolePkid, RoleId = "Admin", RoleName = "Administrator", PermissionLevel = 1, UserIds = ["jenny"],
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("不可將自己移出管理員角色", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task UpdateAdminRole_KeepingSelf_IsAllowed()
    {
        var response = await _admin.PutAsJsonAsync("/api/app-roles", new AppRoleRequest
        {
            Pkid = AdminRolePkid, RoleId = "Admin", RoleName = "Administrator", PermissionLevel = 1, UserIds = ["HELEN"],
        });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task DeleteAdminRole_Returns400()
    {
        var response = await _admin.DeleteAsync($"/api/app-roles/{AdminRolePkid}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("不可刪除管理員角色", await response.Content.ReadAsStringAsync());
    }
}

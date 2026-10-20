using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using CMS.API.Models;
using CMS.API.Tests.Infrastructure;

namespace CMS.API.Tests;

/// <summary>PUT /api/auth/profile: the signed-in user (JWT `sub`) edits only their own UserName.</summary>
public class AuthProfileTests : IDisposable
{
    private const string ProfileUrl = "/api/auth/profile";

    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client; // signed in as helen (CmsApiFactory default)

    public AuthProfileTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    private async Task<AppUserCredential> Stored(string userId)
        => (await _factory.AppUsers.GetCredentialAsync(userId))!;

    private Task<HttpResponseMessage> Put(object body, string? bearer = null)
    {
        var message = new HttpRequestMessage(HttpMethod.Put, ProfileUrl) { Content = JsonContent.Create(body) };
        if (bearer is not null) message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
        return _client.SendAsync(message);
    }

    [Fact]
    public async Task Update_ChangesUserNameOfTheJwtUser_Trimmed()
    {
        var res = await Put(new { userName = "  海倫 Chen  " });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<ProfileResponse>();
        Assert.Equal("helen", body!.UserId);
        Assert.Equal("海倫 Chen", body.UserName);
        Assert.Equal("海倫 Chen", (await Stored("helen")).UserName);
        Assert.Equal("Jenny_Tsao", (await Stored("jenny")).UserName);
    }

    [Fact]
    public async Task Update_UsesTheTokenUser_WhoeverItIs()
    {
        var res = await Put(new { userName = "Jenny T." }, CmsApiFactory.TokenFor("jenny", "Jenny_Tsao", "Admin"));

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal("Jenny T.", (await Stored("jenny")).UserName);
        Assert.Equal("helen", (await Stored("helen")).UserName);
    }

    [Fact]
    public async Task Update_IgnoresUserIdRolesAndIsActiveInTheBody()
    {
        var res = await Put(new { userId = "jenny", userName = "Hacked", roleIds = new[] { "User" }, isActive = false });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal("helen", (await res.Content.ReadFromJsonAsync<ProfileResponse>())!.UserId);

        var helen = await Stored("helen");
        Assert.Equal("Hacked", helen.UserName);
        Assert.Equal(["Admin"], helen.RoleIds); // roles untouched
        Assert.True(helen.IsActive);

        var jenny = await Stored("jenny");
        Assert.Equal("Jenny_Tsao", jenny.UserName); // body userId had no effect
        Assert.Equal(["Admin"], jenny.RoleIds);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public async Task Update_EmptyOrWhitespaceUserName_Returns400_AndKeepsName(string? userName)
    {
        var res = await Put(new { userName });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("請輸入使用者名稱", await res.Content.ReadAsStringAsync());
        Assert.Equal("helen", (await Stored("helen")).UserName);
    }

    [Fact]
    public async Task Update_UserNameOver200Chars_Returns400()
    {
        var res = await Put(new { userName = new string('x', 201) });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Equal("helen", (await Stored("helen")).UserName);
    }

    [Fact]
    public async Task Update_WithoutToken_Returns401()
    {
        _client.DefaultRequestHeaders.Authorization = null;

        var res = await Put(new { userName = "Nobody" });

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        Assert.Equal("helen", (await Stored("helen")).UserName);
    }

    [Fact]
    public async Task Update_TokenUserNoLongerInDb_Returns404()
    {
        var res = await Put(new { userName = "Ghost" }, CmsApiFactory.TokenFor("ghost", "Ghost", "Admin"));

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }
}

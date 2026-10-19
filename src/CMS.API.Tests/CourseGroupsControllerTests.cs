using System.Net;
using System.Net.Http.Json;
using CMS.API.Models;
using CMS.API.Tests.Infrastructure;

namespace CMS.API.Tests;

public class CourseGroupsControllerTests : IDisposable
{
    private const string BaseUrl = "/api/course-groups";

    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client;

    public CourseGroupsControllerTests()
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
    public async Task GetAll_ReturnsAllGroups_SortedByPkidDesc()
    {
        var items = await _client.GetFromJsonAsync<List<CourseGroup>>(BaseUrl);

        Assert.NotNull(items);
        Assert.Equal([3, 2, 1], items.Select(g => (int)g.Pkid));
    }

    [Fact]
    public async Task Query_EmptyFilter_ReturnsAll()
    {
        var items = await PostQuery(new CourseGroupQuery());

        Assert.Equal(3, items.Count);
    }

    [Fact]
    public async Task Query_ByKeyword_MatchesDescription()
    {
        var items = await PostQuery(new CourseGroupQuery { Keyword = " 安全 " });

        Assert.Equal(2, Assert.Single(items).Pkid);
    }

    [Fact]
    public async Task Query_NoMatch_ReturnsEmpty()
    {
        var items = await PostQuery(new CourseGroupQuery { Keyword = "zzz" });

        Assert.Empty(items);
    }

    // ---- View ----

    [Fact]
    public async Task GetById_Existing_ReturnsGroup()
    {
        var item = await _client.GetFromJsonAsync<CourseGroup>($"{BaseUrl}/2");

        Assert.NotNull(item);
        Assert.Equal("資訊安全", item.Description);
    }

    [Theory]
    [InlineData(99)]
    [InlineData(40000)] // outside smallint range
    public async Task GetById_Missing_Returns404(int id)
    {
        var response = await _client.GetAsync($"{BaseUrl}/{id}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ---- Add ----

    [Fact]
    public async Task Create_Valid_Returns201_WithIdentityPkid_AndTrimsDescription()
    {
        var response = await _client.PostAsJsonAsync(BaseUrl, new CourseGroupRequest { Description = "  資料庫  " });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<CourseGroup>();
        Assert.NotNull(created);
        Assert.Equal(4, created.Pkid);
        Assert.Equal("資料庫", created.Description);
        Assert.Equal("/api/course-groups/4", response.Headers.Location?.AbsolutePath, ignoreCase: true);

        var fetched = await _client.GetFromJsonAsync<CourseGroup>($"{BaseUrl}/4");
        Assert.Equal("資料庫", fetched!.Description);
    }

    [Fact]
    public async Task Create_IgnoresPkidInBody()
    {
        var response = await _client.PostAsJsonAsync(BaseUrl, new CourseGroupRequest { Pkid = 2, Description = "資料庫" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(4, (await response.Content.ReadFromJsonAsync<CourseGroup>())!.Pkid);
        Assert.Equal("資訊安全", (await _client.GetFromJsonAsync<CourseGroup>($"{BaseUrl}/2"))!.Description);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Create_MissingDescription_Returns400(string description)
    {
        var response = await _client.PostAsJsonAsync(BaseUrl, new CourseGroupRequest { Description = description });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_DescriptionTooLong_Returns400()
    {
        var response = await _client.PostAsJsonAsync(BaseUrl,
            new CourseGroupRequest { Description = new string('x', 101) });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ---- Edit ----

    [Fact]
    public async Task Update_Existing_Returns204_AndAppliesChanges()
    {
        var response = await _client.PutAsJsonAsync(BaseUrl, new CourseGroupRequest { Pkid = 3, Description = " 網路通訊 " });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var fetched = await _client.GetFromJsonAsync<CourseGroup>($"{BaseUrl}/3");
        Assert.Equal("網路通訊", fetched!.Description);
    }

    [Fact]
    public async Task Update_Missing_Returns404()
    {
        var response = await _client.PutAsJsonAsync(BaseUrl, new CourseGroupRequest { Pkid = 99, Description = "Nope" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Update_MissingDescription_Returns400()
    {
        var response = await _client.PutAsJsonAsync(BaseUrl, new CourseGroupRequest { Pkid = 1, Description = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

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

    [Fact]
    public async Task Delete_InUse_Returns409_WithMessage()
    {
        var response = await _client.DeleteAsync($"{BaseUrl}/1");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Contains("雲端運算", body!["message"]);
        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync($"{BaseUrl}/1")).StatusCode);
    }

    // ---- Lookup ----

    [Fact]
    public async Task Lookup_ReturnsPkidAndDescription_SortedByPkid()
    {
        var items = await _client.GetFromJsonAsync<List<CourseGroupLookup>>("/api/lookups/course-groups");

        Assert.NotNull(items);
        Assert.Equal(["雲端運算", "資訊安全", "網路"], items.Select(g => g.Description));
    }

    private async Task<List<CourseGroup>> PostQuery(CourseGroupQuery query)
    {
        var response = await _client.PostAsJsonAsync($"{BaseUrl}/query", query);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<List<CourseGroup>>())!;
    }
}

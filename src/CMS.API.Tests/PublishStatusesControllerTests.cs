using System.Net;
using System.Net.Http.Json;
using CMS.API.Models;
using CMS.API.Tests.Infrastructure;

namespace CMS.API.Tests;

public class PublishStatusesControllerTests : IDisposable
{
    private const string BaseUrl = "/api/publish-statuses";

    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client;

    public PublishStatusesControllerTests()
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
    public async Task GetAll_ReturnsAllStatuses_SortedByPkid()
    {
        var items = await _client.GetFromJsonAsync<List<PublishStatus>>(BaseUrl);

        Assert.NotNull(items);
        Assert.Equal([1, 2, 3], items.Select(s => (int)s.Pkid));
    }

    [Fact]
    public async Task Query_EmptyFilter_ReturnsAll()
    {
        var items = await PostQuery(new PublishStatusQuery());

        Assert.Equal(3, items.Count);
    }

    [Fact]
    public async Task Query_ByKeyword_MatchesDescription()
    {
        var items = await PostQuery(new PublishStatusQuery { Keyword = " 發布 " });

        Assert.Equal(2, Assert.Single(items).Pkid);
    }

    [Fact]
    public async Task Query_ByFlags_FiltersStatuses()
    {
        Assert.Equal(1, Assert.Single(await PostQuery(new PublishStatusQuery { IsDraft = true })).Pkid);
        Assert.Equal(2, Assert.Single(await PostQuery(new PublishStatusQuery { IsPublished = true })).Pkid);
        Assert.Equal(3, Assert.Single(await PostQuery(new PublishStatusQuery { IsDiscontinued = true })).Pkid);
        Assert.Equal([1, 3], (await PostQuery(new PublishStatusQuery { IsPublished = false })).Select(s => (int)s.Pkid));
    }

    [Fact]
    public async Task Query_NoMatch_ReturnsEmpty()
    {
        var items = await PostQuery(new PublishStatusQuery { Keyword = "zzz", IsDraft = true });

        Assert.Empty(items);
    }

    // ---- View ----

    [Fact]
    public async Task GetById_Existing_ReturnsStatus()
    {
        var item = await _client.GetFromJsonAsync<PublishStatus>($"{BaseUrl}/2");

        Assert.NotNull(item);
        Assert.Equal("已發布", item.Description);
        Assert.True(item.IsPublished);
        Assert.False(item.IsDraft);
    }

    [Theory]
    [InlineData(99)]
    [InlineData(256)] // outside tinyint range
    public async Task GetById_Missing_Returns404(int id)
    {
        var response = await _client.GetAsync($"{BaseUrl}/{id}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ---- Add ----

    [Fact]
    public async Task Create_Valid_Returns201_AndPersists()
    {
        var request = new PublishStatusRequest { Pkid = 10, Description = "  審核中  ", IsDraft = true };

        var response = await _client.PostAsJsonAsync(BaseUrl, request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<PublishStatus>();
        Assert.NotNull(created);
        Assert.Equal(10, created.Pkid);
        Assert.Equal("審核中", created.Description); // trimmed
        Assert.Equal("/api/publish-statuses/10", response.Headers.Location?.AbsolutePath, ignoreCase: true);

        var fetched = await _client.GetFromJsonAsync<PublishStatus>($"{BaseUrl}/10");
        Assert.True(fetched!.IsDraft);
    }

    [Fact]
    public async Task Create_DuplicatePkid_Returns409()
    {
        var response = await _client.PostAsJsonAsync(BaseUrl, new PublishStatusRequest { Pkid = 1, Description = "Dup" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Create_MissingDescription_Returns400()
    {
        var response = await _client.PostAsJsonAsync(BaseUrl, new PublishStatusRequest { Pkid = 11, Description = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_DescriptionTooLong_Returns400()
    {
        var response = await _client.PostAsJsonAsync(BaseUrl,
            new PublishStatusRequest { Pkid = 11, Description = new string('x', 51) });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_PkidOutOfRange_Returns400()
    {
        var response = await _client.PostAsJsonAsync(BaseUrl, new { pkid = 300, description = "Too big" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ---- Edit ----

    [Fact]
    public async Task Update_Existing_Returns204_AndAppliesChanges()
    {
        var response = await _client.PutAsJsonAsync(BaseUrl,
            new PublishStatusRequest { Pkid = 3, Description = "停用", IsDiscontinued = true, IsDraft = true });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var fetched = await _client.GetFromJsonAsync<PublishStatus>($"{BaseUrl}/3");
        Assert.NotNull(fetched);
        Assert.Equal("停用", fetched.Description);
        Assert.True(fetched.IsDraft);
        Assert.True(fetched.IsDiscontinued);
    }

    [Fact]
    public async Task Update_Missing_Returns404()
    {
        var response = await _client.PutAsJsonAsync(BaseUrl, new PublishStatusRequest { Pkid = 99, Description = "Nope" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Update_MissingDescription_Returns400()
    {
        var response = await _client.PutAsJsonAsync(BaseUrl, new PublishStatusRequest { Pkid = 1, Description = "" });

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
        var response = await _client.DeleteAsync($"{BaseUrl}/2");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Contains("已發布", body!["message"]);
        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync($"{BaseUrl}/2")).StatusCode);
    }

    // ---- Lookup ----

    [Fact]
    public async Task Lookup_ReturnsPkidAndDescription_SortedByPkid()
    {
        var items = await _client.GetFromJsonAsync<List<PublishStatusLookup>>("/api/lookups/publish-statuses");

        Assert.NotNull(items);
        Assert.Equal(["草稿", "已發布", "已下架"], items.Select(s => s.Description));
        Assert.Equal([false, true, false], items.Select(s => s.IsPublished));
    }

    private async Task<List<PublishStatus>> PostQuery(PublishStatusQuery query)
    {
        var response = await _client.PostAsJsonAsync($"{BaseUrl}/query", query);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<List<PublishStatus>>())!;
    }
}

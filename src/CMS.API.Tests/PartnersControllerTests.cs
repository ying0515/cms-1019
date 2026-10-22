using System.Net;
using System.Net.Http.Json;
using CMS.API.Models;
using CMS.API.Tests.Infrastructure;

namespace CMS.API.Tests;

public class PartnersControllerTests : IDisposable
{
    private const string BaseUrl = "/api/partners";

    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client;

    public PartnersControllerTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
        GC.SuppressFinalize(this);
    }

    private static PartnerRequest ValidRequest(short pkid = 0) => new()
    {
        Pkid = pkid,
        Name = "Oracle",
        AppKey = "ORA",
        NameOnPartnerMenu = "甲骨文 Oracle",
        NameOnCourseDetailPage = "甲骨文",
        DisplayOrder = 5,
        ImageFilename = "oracle.png",
    };

    // ---- List ----

    [Fact]
    public async Task GetAll_ReturnsAllPartners_SortedByDisplayOrderThenPkidDesc()
    {
        var items = await _client.GetFromJsonAsync<List<Partner>>(BaseUrl);

        Assert.NotNull(items);
        Assert.Equal([3, 1, 2], items.Select(p => (int)p.Pkid));
    }

    [Fact]
    public async Task Query_EmptyFilter_ReturnsAll()
    {
        var items = await PostQuery(new PartnerQuery());

        Assert.Equal(3, items.Count);
    }

    [Theory]
    [InlineData(" cisco ", 2)]      // Name (trimmed, case-insensitive)
    [InlineData("MS", 1)]           // AppKey
    [InlineData("Amazon", 3)]       // NameOnPartnerMenu
    [InlineData("思科", 2)]          // NameOnCourseDetailPage
    [InlineData(".svg", 3)]         // ImageFilename
    public async Task Query_ByKeyword_MatchesEachStringColumn(string keyword, int expectedPkid)
    {
        var items = await PostQuery(new PartnerQuery { Keyword = keyword });

        Assert.Equal(expectedPkid, Assert.Single(items).Pkid);
    }

    [Fact]
    public async Task Query_NoMatch_ReturnsEmpty()
    {
        var items = await PostQuery(new PartnerQuery { Keyword = "zzz" });

        Assert.Empty(items);
    }

    // ---- View ----

    [Fact]
    public async Task GetById_Existing_ReturnsPartner()
    {
        var item = await _client.GetFromJsonAsync<Partner>($"{BaseUrl}/2");

        Assert.NotNull(item);
        Assert.Equal("Cisco", item.Name);
        Assert.Equal("CISCO", item.AppKey);
        Assert.Null(item.ImageFilename);
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
    public async Task Create_Valid_Returns201_WithIdentityPkid_AndTrimsValues()
    {
        var request = ValidRequest();
        request.Name = "  Oracle  ";
        request.ImageFilename = "   ";

        var response = await _client.PostAsJsonAsync(BaseUrl, request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<Partner>();
        Assert.NotNull(created);
        Assert.Equal(4, created.Pkid);
        Assert.Equal("Oracle", created.Name);
        Assert.Null(created.ImageFilename); // blank → null
        Assert.Equal("/api/partners/4", response.Headers.Location?.AbsolutePath, ignoreCase: true);

        var fetched = await _client.GetFromJsonAsync<Partner>($"{BaseUrl}/4");
        Assert.Equal(5, fetched!.DisplayOrder);
    }

    [Fact]
    public async Task Create_IgnoresPkidInBody()
    {
        var response = await _client.PostAsJsonAsync(BaseUrl, ValidRequest(pkid: 2));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<Partner>();
        Assert.Equal(4, created!.Pkid);
        Assert.Equal("Cisco", (await _client.GetFromJsonAsync<Partner>($"{BaseUrl}/2"))!.Name);
    }

    [Theory]
    [InlineData("name")]
    [InlineData("appKey")]
    [InlineData("nameOnPartnerMenu")]
    [InlineData("nameOnCourseDetailPage")]
    public async Task Create_MissingRequiredField_Returns400(string field)
    {
        var body = ToDictionary(ValidRequest());
        body[field] = "";

        var response = await _client.PostAsJsonAsync(BaseUrl, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("name", 51)]
    [InlineData("appKey", 11)]
    [InlineData("nameOnPartnerMenu", 201)]
    [InlineData("nameOnCourseDetailPage", 51)]
    [InlineData("imageFilename", 51)]
    public async Task Create_FieldTooLong_Returns400(string field, int length)
    {
        var body = ToDictionary(ValidRequest());
        body[field] = new string('x', length);

        var response = await _client.PostAsJsonAsync(BaseUrl, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ---- Edit ----

    [Fact]
    public async Task Update_Existing_Returns204_AndAppliesChanges()
    {
        var request = ValidRequest(pkid: 3);
        request.Name = "Amazon";
        request.ImageFilename = null;

        var response = await _client.PutAsJsonAsync(BaseUrl, request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var fetched = await _client.GetFromJsonAsync<Partner>($"{BaseUrl}/3");
        Assert.NotNull(fetched);
        Assert.Equal("Amazon", fetched.Name);
        Assert.Equal("ORA", fetched.AppKey);
        Assert.Equal(5, fetched.DisplayOrder);
        Assert.Null(fetched.ImageFilename);
    }

    [Fact]
    public async Task Update_Missing_Returns404()
    {
        var response = await _client.PutAsJsonAsync(BaseUrl, ValidRequest(pkid: 99));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Update_MissingName_Returns400()
    {
        var request = ValidRequest(pkid: 1);
        request.Name = "";

        var response = await _client.PutAsJsonAsync(BaseUrl, request);

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
        Assert.Contains("Microsoft", body!["message"]);
        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync($"{BaseUrl}/1")).StatusCode);
    }

    // ---- Lookup ----

    [Fact]
    public async Task Lookup_ReturnsPkidAndName_SortedByDisplayOrderThenPkid()
    {
        var items = await _client.GetFromJsonAsync<List<PartnerLookup>>("/api/lookups/partners");

        Assert.NotNull(items);
        Assert.Equal(["Microsoft", "AWS", "Cisco"], items.Select(p => p.Name));
    }

    private static Dictionary<string, object?> ToDictionary(PartnerRequest r) => new()
    {
        ["pkid"] = r.Pkid,
        ["name"] = r.Name,
        ["appKey"] = r.AppKey,
        ["nameOnPartnerMenu"] = r.NameOnPartnerMenu,
        ["nameOnCourseDetailPage"] = r.NameOnCourseDetailPage,
        ["displayOrder"] = r.DisplayOrder,
        ["imageFilename"] = r.ImageFilename,
    };

    private async Task<List<Partner>> PostQuery(PartnerQuery query)
    {
        var response = await _client.PostAsJsonAsync($"{BaseUrl}/query", query);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<List<Partner>>())!;
    }
}

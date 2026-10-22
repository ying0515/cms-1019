using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using CMS.API.Models;
using CMS.API.Tests.Infrastructure;

namespace CMS.API.Tests;

public class CoursesControllerTests : IDisposable
{
    private const string BaseUrl = "/api/courses";

    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client;

    public CoursesControllerTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
        GC.SuppressFinalize(this);
    }

    private static CourseRequest ValidRequest(int pkid = 0) => new()
    {
        Pkid = pkid,
        Title = "Oracle 資料庫管理",
        OfficialTitle = "Oracle Database Administration",
        CourseId = "ORA-DBA",
        ProdCourseId = "1Z0-082",
        FriendlyUrl = "oracle-dba",
        DisplayOrder = 5,
        PartnerPkid = 2,
        CourseGroupPkid = 2,
        PublishStatusPkid = 1,
        ScheduleOn = new DateOnly(2026, 10, 1),
        ScheduleOff = new DateOnly(2036, 10, 1),
        Hour = 30,
        ListPrice = 30000,
        LearningCredit = 3.5m,
        Outline = "第一章 架構",
        CanRepeat = true,
        CertificationPkids = [2, 3],
        JobCategoryPkids = [2],
    };

    // ---- List ----

    [Fact]
    public async Task GetAll_ReturnsAllCourses_SortedByDisplayOrderThenPkidDesc_WithNavObjects()
    {
        var items = await _client.GetFromJsonAsync<List<Course>>(BaseUrl);

        Assert.NotNull(items);
        Assert.Equal([3, 1, 2], items.Select(c => c.Pkid));
        var az = items.Single(c => c.Pkid == 1);
        Assert.Equal("Microsoft", az.Partner?.Name);
        Assert.Equal("雲端運算", az.CourseGroup?.Description);
        Assert.Equal("已發布", az.PublishStatus?.Description);
        Assert.Equal(new DateOnly(2026, 1, 1), az.ScheduleOn);
        Assert.Null(items.Single(c => c.Pkid == 3).CourseGroup); // nullable FK
    }

    [Fact]
    public async Task GetAll_SerializesNavObjectsAndDatesForTheListPage()
    {
        var json = await _client.GetStringAsync(BaseUrl);
        var first = JsonNode.Parse(json)!.AsArray()[0]!;

        Assert.Equal("AWS", (string?)first["partner"]?["name"]);
        Assert.Equal("草稿", (string?)first["publishStatus"]?["description"]);
        Assert.Null(first["courseGroup"]);
        Assert.Equal("2026-06-15", (string?)first["scheduleOn"]);
    }

    [Fact]
    public async Task Query_EmptyFilter_ReturnsAll()
    {
        var items = await PostQuery(new CourseQuery());

        Assert.Equal(3, items.Count);
    }

    [Theory]
    [InlineData(" 管理員 ", 1)]        // Title (trimmed)
    [InlineData("administrator", 1)]  // OfficialTitle (case-insensitive)
    [InlineData("aws-saa", 3)]        // CourseId / FriendlyUrl
    [InlineData("200-301", 2)]        // ProdCourseId
    [InlineData("ccna", 2)]           // CourseId / FriendlyUrl
    public async Task Query_ByKeyword_MatchesStringColumns(string keyword, int expectedPkid)
    {
        var items = await PostQuery(new CourseQuery { Keyword = keyword });

        Assert.Equal(expectedPkid, Assert.Single(items).Pkid);
    }

    [Fact]
    public async Task Query_ByKeyword_DoesNotSearchLargeTextColumns()
    {
        var items = await PostQuery(new CourseQuery { Keyword = "訂用帳戶" }); // in Objective only

        Assert.Empty(items);
    }

    [Fact]
    public async Task Query_ByPartner()
    {
        var items = await PostQuery(new CourseQuery { PartnerPkid = 2 });

        Assert.Equal([2], items.Select(c => c.Pkid));
    }

    [Fact]
    public async Task Query_ByCourseGroup()
    {
        var items = await PostQuery(new CourseQuery { CourseGroupPkid = 1 });

        Assert.Equal([1], items.Select(c => c.Pkid));
    }

    [Fact]
    public async Task Query_ByPublishStatus()
    {
        var items = await PostQuery(new CourseQuery { PublishStatusPkid = 2 });

        Assert.Equal([1, 2], items.Select(c => c.Pkid));
    }

    [Fact]
    public async Task Query_ByScheduleOnRange_IsInclusive()
    {
        var items = await PostQuery(new CourseQuery
        {
            ScheduleOnFrom = new DateOnly(2026, 3, 1),
            ScheduleOnTo = new DateOnly(2026, 6, 15),
        });

        Assert.Equal([3, 2], items.Select(c => c.Pkid));
    }

    [Fact]
    public async Task Query_ByScheduleOffRange()
    {
        var to = await PostQuery(new CourseQuery { ScheduleOffTo = new DateOnly(2030, 1, 1) });
        var from = await PostQuery(new CourseQuery { ScheduleOffFrom = new DateOnly(2036, 1, 1) });

        Assert.Equal([2], to.Select(c => c.Pkid));
        Assert.Equal([3, 1], from.Select(c => c.Pkid));
    }

    [Theory]
    [InlineData(true, new[] { 3, 1 })]
    [InlineData(false, new[] { 2 })]
    public async Task Query_ByCanRepeat(bool canRepeat, int[] expected)
    {
        var items = await PostQuery(new CourseQuery { CanRepeat = canRepeat });

        Assert.Equal(expected, items.Select(c => c.Pkid));
    }

    [Fact]
    public async Task Query_CombinedFilters_AreAnded()
    {
        var match = await PostQuery(new CourseQuery { PartnerPkid = 1, CanRepeat = true, Keyword = "AZ" });
        var none = await PostQuery(new CourseQuery { PartnerPkid = 1, CanRepeat = false });

        Assert.Equal([1], match.Select(c => c.Pkid));
        Assert.Empty(none);
    }

    // ---- View ----

    [Fact]
    public async Task GetById_Existing_ReturnsCourse_WithRelations()
    {
        var item = await _client.GetFromJsonAsync<Course>($"{BaseUrl}/3");

        Assert.NotNull(item);
        Assert.Equal("AWS-SAA", item.CourseId);
        Assert.Equal("AWS", item.Partner?.Name);
        Assert.Null(item.CourseGroupPkid);
        Assert.False(item.PublishStatus?.IsPublished); // 草稿
        Assert.Empty(item.Certifications);
        Assert.Equal(["系統管理", "軟體開發"], item.JobCategories.Select(j => j.Description));
    }

    [Fact]
    public async Task GetById_IncludesCertificationWithPartnerName()
    {
        var item = await _client.GetFromJsonAsync<Course>($"{BaseUrl}/2");

        var cert = Assert.Single(item!.Certifications);
        Assert.Equal("CCNA", cert.Title);
        Assert.Equal("Cisco", cert.PartnerName);
    }

    [Fact]
    public async Task GetById_Missing_Returns404()
    {
        var response = await _client.GetAsync($"{BaseUrl}/99");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ---- Add ----

    [Fact]
    public async Task Create_Valid_Returns201_WithIdentityPkid_RelationsAndTrimmedValues()
    {
        var request = ValidRequest();
        request.Title = "  Oracle 資料庫管理  ";
        request.Material = "   ";
        request.CertificationPkids = [3, 2, 3]; // duplicates are ignored

        var response = await _client.PostAsJsonAsync(BaseUrl, request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<Course>();
        Assert.NotNull(created);
        Assert.Equal(4, created.Pkid);
        Assert.Equal("Oracle 資料庫管理", created.Title);
        Assert.Null(created.Material); // blank → null
        Assert.Equal("Cisco", created.Partner?.Name);
        Assert.Equal("資訊安全", created.CourseGroup?.Description);
        Assert.Equal(new DateOnly(2036, 10, 1), created.ScheduleOff);
        Assert.Equal(3.5m, created.LearningCredit);
        Assert.Equal([2, 3], created.Certifications.Select(c => c.Pkid).Order());
        Assert.Equal([(short)2], created.JobCategories.Select(j => j.Pkid));
        Assert.Equal("/api/courses/4", response.Headers.Location?.AbsolutePath, ignoreCase: true);
    }

    [Fact]
    public async Task Create_IgnoresPkidInBody()
    {
        var response = await _client.PostAsJsonAsync(BaseUrl, ValidRequest(pkid: 2));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(4, (await response.Content.ReadFromJsonAsync<Course>())!.Pkid);
        Assert.Equal("CCNA", (await _client.GetFromJsonAsync<Course>($"{BaseUrl}/2"))!.CourseId);
    }

    [Fact]
    public async Task Create_ZeroCourseGroup_IsStoredAsNull()
    {
        var request = ValidRequest();
        request.CourseGroupPkid = 0;

        var response = await _client.PostAsJsonAsync(BaseUrl, request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<Course>();
        Assert.Null(created!.CourseGroupPkid);
        Assert.Null(created.CourseGroup);
    }

    [Theory]
    [InlineData("title")]
    [InlineData("courseId")]
    [InlineData("prodCourseId")]
    [InlineData("friendlyUrl")]
    public async Task Create_MissingRequiredString_Returns400(string field)
    {
        var body = ToJson(ValidRequest());
        body[field] = "";

        var response = await _client.PostAsJsonAsync(BaseUrl, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("scheduleOn")]
    [InlineData("scheduleOff")]
    public async Task Create_MissingDate_Returns400(string field)
    {
        var body = ToJson(ValidRequest());
        body.Remove(field);

        var response = await _client.PostAsJsonAsync(BaseUrl, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("partnerPkid")]
    [InlineData("publishStatusPkid")]
    public async Task Create_MissingRequiredForeignKey_Returns400(string field)
    {
        var body = ToJson(ValidRequest());
        body[field] = 0;

        var response = await _client.PostAsJsonAsync(BaseUrl, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("title", 201)]
    [InlineData("officialTitle", 301)]
    [InlineData("courseId", 51)]
    [InlineData("prodCourseId", 51)]
    [InlineData("friendlyUrl", 101)]
    [InlineData("material", 501)]
    [InlineData("target", 501)]
    [InlineData("objective", 4001)]
    [InlineData("prerequisites", 4001)]
    [InlineData("note", 4001)]
    [InlineData("otherInfo", 4001)]
    public async Task Create_FieldTooLong_Returns400(string field, int length)
    {
        var body = ToJson(ValidRequest());
        body[field] = new string('x', length);

        var response = await _client.PostAsJsonAsync(BaseUrl, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("hour")]
    [InlineData("listPrice")]
    [InlineData("learningCredit")]
    public async Task Create_NegativeNumber_Returns400(string field)
    {
        var body = ToJson(ValidRequest());
        body[field] = -1;

        var response = await _client.PostAsJsonAsync(BaseUrl, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_ScheduleOffBeforeScheduleOn_Returns400()
    {
        var request = ValidRequest();
        request.ScheduleOff = new DateOnly(2026, 9, 30);

        var response = await _client.PostAsJsonAsync(BaseUrl, request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("下架日期", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Create_SameDayScheduleOnAndOff_IsAllowed()
    {
        var request = ValidRequest();
        request.ScheduleOff = request.ScheduleOn;

        var response = await _client.PostAsJsonAsync(BaseUrl, request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Theory]
    [InlineData("partnerPkid", 99)]
    [InlineData("courseGroupPkid", 99)]
    [InlineData("publishStatusPkid", 99)]
    public async Task Create_UnknownForeignKey_Returns400_WithMessage(string field, int value)
    {
        var body = ToJson(ValidRequest());
        body[field] = value;

        var response = await _client.PostAsJsonAsync(BaseUrl, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Contains("不存在", json!["message"]);
    }

    [Fact]
    public async Task Create_UnknownCertification_Returns400()
    {
        var request = ValidRequest();
        request.CertificationPkids = [99];

        var response = await _client.PostAsJsonAsync(BaseUrl, request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(3, (await PostQuery(new CourseQuery())).Count);
    }

    // ---- Edit ----

    [Fact]
    public async Task Update_Existing_Returns204_AndAppliesChangesAndRelations()
    {
        var request = ValidRequest(pkid: 2);
        request.CourseGroupPkid = null;
        request.CertificationPkids = [];
        request.JobCategoryPkids = [1, 3];

        var response = await _client.PutAsJsonAsync(BaseUrl, request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var fetched = await _client.GetFromJsonAsync<Course>($"{BaseUrl}/2");
        Assert.NotNull(fetched);
        Assert.Equal("ORA-DBA", fetched.CourseId);
        Assert.Equal(new DateOnly(2026, 10, 1), fetched.ScheduleOn);
        Assert.Null(fetched.CourseGroup);
        Assert.Empty(fetched.Certifications);
        Assert.Equal([(short)1, (short)3], fetched.JobCategories.Select(j => j.Pkid));
    }

    [Fact]
    public async Task Update_Missing_Returns404()
    {
        var response = await _client.PutAsJsonAsync(BaseUrl, ValidRequest(pkid: 99));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Update_MissingTitle_Returns400()
    {
        var request = ValidRequest(pkid: 1);
        request.Title = "";

        var response = await _client.PutAsJsonAsync(BaseUrl, request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Update_UnknownPartner_Returns400_AndLeavesRowUnchanged()
    {
        var request = ValidRequest(pkid: 1);
        request.PartnerPkid = 99;

        var response = await _client.PutAsJsonAsync(BaseUrl, request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("AZ-104", (await _client.GetFromJsonAsync<Course>($"{BaseUrl}/1"))!.CourseId);
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
        Assert.Contains("AZ-104", body!["message"]);
        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync($"{BaseUrl}/1")).StatusCode);
    }

    // ---- Lookups ----

    [Fact]
    public async Task CertificationLookup_ReturnsTitleAndPartner_SortedByPartnerOrderThenTitle()
    {
        var items = await _client.GetFromJsonAsync<List<CertificationLookup>>("/api/lookups/certifications");

        Assert.NotNull(items);
        Assert.Equal([1, 2, 3], items.Select(c => c.Pkid));
        Assert.Equal("Microsoft", items[0].PartnerName);
        Assert.Equal("CCNA", items[2].Title);
    }

    [Fact]
    public async Task JobCategoryLookup_ReturnsPkidAndDescription_SortedByPkid()
    {
        var items = await _client.GetFromJsonAsync<List<JobCategoryLookup>>("/api/lookups/job-categories");

        Assert.NotNull(items);
        Assert.Equal(["系統管理", "軟體開發", "網路工程"], items.Select(j => j.Description));
    }

    private static JsonObject ToJson(CourseRequest r)
        => JsonSerializer.SerializeToNode(r, JsonSerializerOptions.Web)!.AsObject();

    private async Task<List<Course>> PostQuery(CourseQuery query)
    {
        var response = await _client.PostAsJsonAsync($"{BaseUrl}/query", query);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<List<Course>>())!;
    }
}

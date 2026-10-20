using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using CMS.API.Models;
using CMS.API.Tests.Infrastructure;

namespace CMS.API.Tests;

public class AgentTokenUsageControllerTests : IDisposable
{
    private const string BaseUrl = "/api/agent-token-usage";
    private const string ReportUrl = "/api/agent-token-usage/report";

    // CmsApiFactory pins the clock to 2026-10-20 11:00 in Taipei
    private static readonly DateOnly Today = new(2026, 10, 20);

    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client;

    public AgentTokenUsageControllerTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    private static AgentTokenUsageItem Item(DateOnly date, string model = "claude-opus-5-5",
        long input = 120, long output = 45000, long cacheWrite = 380000, long cacheRead = 9100000) => new()
    {
        UsageDate = date,
        Model = model,
        InputTokens = input,
        OutputTokens = output,
        CacheWriteTokens = cacheWrite,
        CacheReadTokens = cacheRead,
    };

    private static AgentTokenUsageSubmitRequest Submission(string sessionId = "s-1", string userId = "jenny",
        string project = "cms-1019", params AgentTokenUsageItem[] items) => new()
    {
        SessionId = sessionId,
        UserId = userId,
        Project = project,
        Items = items.Length > 0 ? [.. items] : [Item(Today)],
    };

    private Task<HttpResponseMessage> Submit(object body, string? apiKey = CmsApiFactory.ApiKey)
    {
        var message = new HttpRequestMessage(HttpMethod.Post, BaseUrl) { Content = JsonContent.Create(body) };
        if (apiKey is not null) message.Headers.Add("X-Api-Key", apiKey);
        return _client.SendAsync(message);
    }

    private async Task<List<AgentTokenUsageReportRow>> Report(AgentTokenUsageReportQuery? query = null)
    {
        var response = await _client.PostAsJsonAsync(ReportUrl, query ?? new AgentTokenUsageReportQuery());
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<List<AgentTokenUsageReportRow>>())!;
    }

    // ---- Submit ----

    [Fact]
    public async Task Submit_Valid_Returns204_AndRowShowsOnReport()
    {
        var response = await Submit(Submission());

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var row = Assert.Single(await Report());
        Assert.Equal("jenny", row.UserId);
        Assert.Equal("Jenny_Tsao", row.UserName);
        Assert.Equal(Today, row.UsageDate);
        Assert.Equal("cms-1019", row.Project);
        Assert.Equal("claude-opus-5-5", row.Model);
        Assert.Equal(120, row.InputTokens);
        Assert.Equal(45000, row.OutputTokens);
        Assert.Equal(380000, row.CacheWriteTokens);
        Assert.Equal(9100000, row.CacheReadTokens);
        Assert.Null(row.Cost);
        Assert.Equal(1, row.UnpricedCount);
        Assert.Equal(1, row.SessionCount);
    }

    [Fact]
    public async Task Submit_SameSessionAgain_OverwritesTotals_WithoutDoubleCounting()
    {
        await Submit(Submission(items: Item(Today, input: 100, output: 200, cacheWrite: 300, cacheRead: 400)));

        var response = await Submit(Submission(items: Item(Today, input: 150, output: 250, cacheWrite: 350, cacheRead: 450)));

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var row = Assert.Single(await Report());
        Assert.Equal([150L, 250L, 350L, 450L],
            new[] { row.InputTokens, row.OutputTokens, row.CacheWriteTokens, row.CacheReadTokens });
        Assert.Equal(1, row.SessionCount);
    }

    [Fact]
    public async Task Submit_RowsMissingFromPayload_AreLeftUntouched()
    {
        var yesterday = Today.AddDays(-1);
        await Submit(Submission(items: [Item(yesterday, input: 10), Item(Today, input: 20)]));

        // Resubmit only today's row
        await Submit(Submission(items: Item(Today, input: 25)));

        var rows = await Report();
        Assert.Equal([(Today, 25L), (yesterday, 10L)], rows.Select(r => (r.UsageDate, r.InputTokens)));
    }

    // ---- Report ----

    [Fact]
    public async Task Report_AddsUpSessions_ByUserDateProjectAndModel()
    {
        await Submit(Submission("s-1", items: Item(Today, input: 1, output: 10, cacheWrite: 100, cacheRead: 1000)));
        await Submit(Submission("s-2", items: Item(Today, input: 2, output: 20, cacheWrite: 200, cacheRead: 2000)));
        await Submit(Submission("s-3", project: "other-repo", items: Item(Today, input: 4)));
        await Submit(Submission("s-4", userId: "helen", items: Item(Today, input: 8)));
        await Submit(Submission("s-5", items: Item(Today, "claude-haiku-5-5", input: 16)));

        var rows = await Report();

        // Newest date first, then UserId, Project, Model
        Assert.Equal(
            [
                ("helen", "cms-1019", "claude-opus-5-5"),
                ("jenny", "cms-1019", "claude-haiku-5-5"),
                ("jenny", "cms-1019", "claude-opus-5-5"),
                ("jenny", "other-repo", "claude-opus-5-5"),
            ],
            rows.Select(r => (r.UserId, r.Project, r.Model)));
        var combined = rows[2];
        Assert.Equal("Jenny_Tsao", combined.UserName);
        Assert.Equal([3L, 30L, 300L, 3000L],
            new[] { combined.InputTokens, combined.OutputTokens, combined.CacheWriteTokens, combined.CacheReadTokens });
        Assert.Equal(2, combined.SessionCount);
        Assert.Equal(2, combined.UnpricedCount);
        Assert.Null(combined.Cost);
        Assert.Equal("helen", rows[0].UserName);
    }

    [Fact]
    public async Task Report_SessionCrossingMidnight_CountsOncePerDate()
    {
        await Submit(Submission("s-1", items: [Item(Today.AddDays(-1)), Item(Today)]));

        var rows = await Report();

        Assert.Equal([Today, Today.AddDays(-1)], rows.Select(r => r.UsageDate));
        Assert.All(rows, r => Assert.Equal(1, r.SessionCount));
    }

    [Fact]
    public async Task Report_FiltersByInclusiveDateRange()
    {
        var d = new DateOnly(2026, 10, 1);
        await Submit(Submission(items: [Item(d.AddDays(-1)), Item(d), Item(d.AddDays(5)), Item(d.AddDays(6))]));

        var rows = await Report(new AgentTokenUsageReportQuery { UsageDateFrom = d, UsageDateTo = d.AddDays(5) });

        Assert.Equal([d.AddDays(5), d], rows.Select(r => r.UsageDate));
    }

    [Fact]
    public async Task Report_OpenEndedDateRange()
    {
        var d = new DateOnly(2026, 10, 1);
        await Submit(Submission(items: [Item(d.AddDays(-1)), Item(d), Item(d.AddDays(1))]));

        Assert.Equal([d.AddDays(1), d], (await Report(new() { UsageDateFrom = d })).Select(r => r.UsageDate));
        Assert.Equal([d, d.AddDays(-1)], (await Report(new() { UsageDateTo = d })).Select(r => r.UsageDate));
    }

    [Fact]
    public async Task Report_SerializesUsageDateAsIsoDate()
    {
        await Submit(Submission());

        var response = await _client.PostAsJsonAsync(ReportUrl, new AgentTokenUsageReportQuery());
        var json = JsonNode.Parse(await response.Content.ReadAsStringAsync())!.AsArray();

        Assert.Equal("2026-10-20", json[0]!["usageDate"]!.GetValue<string>());
        Assert.Equal("Jenny_Tsao", json[0]!["userName"]!.GetValue<string>());
    }

    // ---- 400 rules (whole request rejected, nothing written) ----

    private static JsonObject ValidBody() => (JsonObject)JsonNode.Parse("""
        {
          "sessionId": "s-1", "userId": "jenny", "project": "cms-1019",
          "items": [
            { "usageDate": "2026-10-19", "model": "claude-opus-5-5",
              "inputTokens": 1, "outputTokens": 2, "cacheWriteTokens": 3, "cacheReadTokens": 4 },
            { "usageDate": "2026-10-20", "model": "claude-opus-5-5",
              "inputTokens": 1, "outputTokens": 2, "cacheWriteTokens": 3, "cacheReadTokens": 4 }
          ]
        }
        """)!;

    private async Task AssertRejected(object body)
    {
        var response = await Submit(body);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(_factory.AgentTokenUsage.Rows);
    }

    [Fact]
    public async Task Submit_ValidBodyHelper_IsAccepted()
    {
        var response = await Submit(ValidBody());

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(2, _factory.AgentTokenUsage.Rows.Count);
    }

    [Theory]
    [InlineData("sessionId", "")]
    [InlineData("sessionId", "   ")]
    [InlineData("userId", "")]
    [InlineData("project", " ")]
    public async Task Submit_EmptyField_Returns400(string field, string value)
    {
        var body = ValidBody();
        body[field] = value;
        await AssertRejected(body);
    }

    [Theory]
    [InlineData("sessionId")]
    [InlineData("userId")]
    [InlineData("project")]
    public async Task Submit_MissingField_Returns400(string field)
    {
        var body = ValidBody();
        body.Remove(field);
        await AssertRejected(body);
    }

    [Theory]
    [InlineData("sessionId", 101)]
    [InlineData("userId", 201)]
    [InlineData("project", 201)]
    public async Task Submit_TooLongField_Returns400(string field, int length)
    {
        var body = ValidBody();
        body[field] = new string('x', length);
        await AssertRejected(body);
    }

    [Theory]
    [InlineData("")]
    [InlineData("  ")]
    public async Task Submit_EmptyModel_Returns400(string model)
    {
        var body = ValidBody();
        body["items"]![1]!["model"] = model;
        await AssertRejected(body);
    }

    [Fact]
    public async Task Submit_TooLongModel_Returns400()
    {
        var body = ValidBody();
        body["items"]![1]!["model"] = new string('m', 101);
        await AssertRejected(body);
    }

    [Fact]
    public async Task Submit_MissingUsageDate_Returns400()
    {
        var body = ValidBody();
        body["items"]![1]!.AsObject().Remove("usageDate");
        await AssertRejected(body);
    }

    [Fact]
    public async Task Submit_NoItems_Returns400()
    {
        var body = ValidBody();
        body["items"] = new JsonArray();
        await AssertRejected(body);
    }

    [Fact]
    public async Task Submit_ItemsMissing_Returns400()
    {
        var body = ValidBody();
        body.Remove("items");
        await AssertRejected(body);
    }

    [Theory]
    [InlineData("inputTokens")]
    [InlineData("outputTokens")]
    [InlineData("cacheWriteTokens")]
    [InlineData("cacheReadTokens")]
    public async Task Submit_NegativeTokenCount_Returns400(string field)
    {
        var body = ValidBody();
        body["items"]![1]![field] = -1;
        await AssertRejected(body);
    }

    [Fact]
    public async Task Submit_NullItem_Returns400()
    {
        var body = ValidBody();
        body["items"]!.AsArray().Add(null);
        await AssertRejected(body);
    }

    [Theory]
    [InlineData("nobody")]
    [InlineData("miles")]   // inactive
    public async Task Submit_UnknownOrInactiveUser_Returns400_WithMessage(string userId)
    {
        var response = await Submit(Submission(userId: userId));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Contains(userId, json!["message"]);
        Assert.Empty(_factory.AgentTokenUsage.Rows);
    }

    [Fact]
    public async Task Submit_UsageDateAfterTodayInTaipei_Returns400()
    {
        await AssertRejected(Submission(items: [Item(Today), Item(Today.AddDays(1), "claude-haiku-5-5")]));
    }

    [Fact]
    public async Task Submit_TodayInTaipei_IsAheadOfUtcDate()
    {
        // 2026-10-20 17:00 UTC is already 2026-10-21 01:00 in Taipei
        _factory.Clock.Now = new DateTimeOffset(2026, 10, 20, 17, 0, 0, TimeSpan.Zero);

        var response = await Submit(Submission(items: Item(new DateOnly(2026, 10, 21))));

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task Submit_TodayInTaipei_BeforeTaipeiMidnight_RejectsTomorrow()
    {
        // 2026-10-20 15:59 UTC is still 2026-10-20 23:59 in Taipei
        _factory.Clock.Now = new DateTimeOffset(2026, 10, 20, 15, 59, 0, TimeSpan.Zero);

        await AssertRejected(Submission(items: Item(new DateOnly(2026, 10, 21))));
    }

    [Fact]
    public async Task Submit_DuplicateDateAndModel_Returns400()
    {
        await AssertRejected(Submission(items: [Item(Today), Item(Today.AddDays(-1)), Item(Today)]));
    }

    [Fact]
    public async Task Submit_SameDateDifferentModels_IsAccepted()
    {
        var response = await Submit(Submission(items: [Item(Today), Item(Today, "claude-sonnet-5-5")]));

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(2, _factory.AgentTokenUsage.Rows.Count);
    }

    // ---- API key ----

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("wrong-key")]
    [InlineData("test-api-ke")]
    [InlineData("TEST-API-KEY")]
    public async Task Submit_MissingOrWrongApiKey_Returns401_AndWritesNothing(string? apiKey)
    {
        var response = await Submit(Submission(), apiKey);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Empty(_factory.AgentTokenUsage.Rows);
    }

    [Fact]
    public async Task Submit_InvalidBodyWithoutApiKey_Returns401NotValidation400()
    {
        var response = await Submit(new { sessionId = "", items = Array.Empty<object>() }, apiKey: null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Report_DoesNotRequireApiKey()
    {
        var response = await _client.PostAsJsonAsync(ReportUrl, new AgentTokenUsageReportQuery());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}

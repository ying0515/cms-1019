using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using CMS.API.Models;
using CMS.API.Tests.Infrastructure;

namespace CMS.API.Tests;

/// <summary>
/// ModelPrice CRUD plus the cost recompute of AgentTokenUsage rows. Fake seed mirrors database/agent-seed.sql:
/// 1 claude-opus-5-5 (4 / 20 / 8 / 0.2), 2 claude-sonnet-5-5 (2 / 10 / 4 / 0.2), 3 claude-haiku-5-5
/// (0.1 / 0.5 / 0.2 / 0.01), all effective 2026-01-01.
/// </summary>
public class ModelPricesControllerTests : IDisposable
{
    private const string BaseUrl = "/api/model-prices";
    private const string UsageUrl = "/api/agent-token-usage";
    private const string ReportUrl = "/api/agent-token-usage/report";
    private static readonly DateOnly Seeded = new(2026, 1, 1);

    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client;

    public ModelPricesControllerTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    private static ModelPriceRequest ValidRequest(int pkid = 0, string model = "claude-opus-5-5",
        DateOnly? effectiveFrom = null, decimal input = 5, decimal output = 25, decimal cacheWrite = 10,
        decimal cacheRead = 0.5m) => new()
    {
        Pkid = pkid,
        Model = model,
        EffectiveFrom = effectiveFrom ?? new DateOnly(2026, 10, 1),
        InputPrice = input,
        OutputPrice = output,
        CacheWritePrice = cacheWrite,
        CacheReadPrice = cacheRead,
    };

    private static JsonObject ToJson(ModelPriceRequest request)
        => JsonSerializer.SerializeToNode(request, JsonSerializerOptions.Web)!.AsObject();

    private async Task<List<ModelPrice>> PostQuery(ModelPriceQuery query)
    {
        var response = await _client.PostAsJsonAsync($"{BaseUrl}/query", query);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<List<ModelPrice>>())!;
    }

    /// <summary>One usage row: 1M input + 1M output + 1M cache write + 1M cache read, so cost = sum of the 4 prices.</summary>
    private async Task SubmitMillion(string sessionId, DateOnly date, string model)
    {
        var message = new HttpRequestMessage(HttpMethod.Post, UsageUrl)
        {
            Content = JsonContent.Create(new AgentTokenUsageSubmitRequest
            {
                SessionId = sessionId,
                UserId = "jenny",
                Project = "cms-1019",
                Items =
                [
                    new()
                    {
                        UsageDate = date, Model = model, InputTokens = 1_000_000, OutputTokens = 1_000_000,
                        CacheWriteTokens = 1_000_000, CacheReadTokens = 1_000_000,
                    },
                ],
            }),
        };
        message.Headers.Add("X-Api-Key", CmsApiFactory.ApiKey);
        var response = await _client.SendAsync(message);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    /// <summary>Report cost per (date, model), newest date first.</summary>
    private async Task<List<(DateOnly, string, decimal?)>> Costs()
    {
        var response = await _client.PostAsJsonAsync(ReportUrl, new AgentTokenUsageReportQuery());
        response.EnsureSuccessStatusCode();
        var rows = (await response.Content.ReadFromJsonAsync<List<AgentTokenUsageReportRow>>())!;
        return rows.Select(r => (r.UsageDate, r.Model, r.Cost)).ToList();
    }

    // ---- List / query / get ----

    [Fact]
    public async Task GetAll_ReturnsSeededPrices_SortedByModelThenEffectiveFromDesc()
    {
        await _client.PostAsJsonAsync(BaseUrl, ValidRequest(model: "claude-opus-5-5", effectiveFrom: new(2026, 10, 1)));

        var items = await _client.GetFromJsonAsync<List<ModelPrice>>(BaseUrl);

        Assert.Equal(
            [
                ("claude-haiku-5-5", Seeded),
                ("claude-opus-5-5", new DateOnly(2026, 10, 1)),
                ("claude-opus-5-5", Seeded),
                ("claude-sonnet-5-5", Seeded),
            ],
            items!.Select(i => (i.Model, i.EffectiveFrom)));
        var opus = items.Single(i => i.Pkid == 1);
        Assert.Equal([4m, 20m, 8m, 0.2m], new[] { opus.InputPrice, opus.OutputPrice, opus.CacheWritePrice, opus.CacheReadPrice });
    }

    [Fact]
    public async Task GetAll_SerializesEffectiveFromAsIsoDate()
    {
        var json = JsonNode.Parse(await _client.GetStringAsync(BaseUrl))!.AsArray();

        Assert.Equal("2026-01-01", (string)json[0]!["effectiveFrom"]!);
    }

    [Fact]
    public async Task Query_ByKeyword_MatchesPartOfModel()
    {
        var items = await PostQuery(new ModelPriceQuery { Keyword = "  SONNET " });

        Assert.Equal([2], items.Select(i => i.Pkid));
    }

    [Fact]
    public async Task Query_ByEffectiveFromRange_IsInclusive()
    {
        await _client.PostAsJsonAsync(BaseUrl, ValidRequest(effectiveFrom: new(2026, 10, 1)));

        var from = await PostQuery(new ModelPriceQuery { EffectiveFromFrom = new(2026, 10, 1) });
        var to = await PostQuery(new ModelPriceQuery { EffectiveFromTo = Seeded });

        Assert.Equal([new DateOnly(2026, 10, 1)], from.Select(i => i.EffectiveFrom));
        Assert.Equal([3, 1, 2], to.Select(i => i.Pkid));
    }

    [Fact]
    public async Task Query_EmptyFilter_ReturnsAll()
    {
        Assert.Equal([3, 1, 2], (await PostQuery(new ModelPriceQuery())).Select(i => i.Pkid));
    }

    [Fact]
    public async Task GetById_Existing_ReturnsItem()
    {
        var item = await _client.GetFromJsonAsync<ModelPrice>($"{BaseUrl}/2");

        Assert.Equal("claude-sonnet-5-5", item!.Model);
        Assert.Equal(Seeded, item.EffectiveFrom);
    }

    [Fact]
    public async Task GetById_Missing_Returns404()
    {
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"{BaseUrl}/99")).StatusCode);
    }

    // ---- Create ----

    [Fact]
    public async Task Create_Valid_Returns201_WithIdentityPkid_AndTrimmedModel()
    {
        var response = await _client.PostAsJsonAsync(BaseUrl, ValidRequest(pkid: 77, model: "  claude-new  "));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = (await response.Content.ReadFromJsonAsync<ModelPrice>())!;
        Assert.Equal(4, created.Pkid);
        Assert.Equal("claude-new", created.Model);
        Assert.Equal(new DateOnly(2026, 10, 1), created.EffectiveFrom);
        Assert.Equal([5m, 25m, 10m, 0.5m],
            new[] { created.InputPrice, created.OutputPrice, created.CacheWritePrice, created.CacheReadPrice });
        Assert.EndsWith($"{BaseUrl}/4", response.Headers.Location!.ToString());
    }

    [Fact]
    public async Task Create_SameModelAndEffectiveFrom_Returns409_WithMessage()
    {
        var response = await _client.PostAsJsonAsync(BaseUrl, ValidRequest(model: "claude-opus-5-5", effectiveFrom: Seeded));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Equal("此模型在該生效日已有定價", json!["message"]);
        Assert.Equal(3, _factory.ModelPrices.Items.Count);
    }

    [Fact]
    public async Task Create_SameModelOtherDate_IsAllowed()
    {
        var response = await _client.PostAsJsonAsync(BaseUrl, ValidRequest(model: "claude-opus-5-5", effectiveFrom: new(2026, 1, 2)));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Create_EmptyModel_Returns400(string model)
    {
        var body = ToJson(ValidRequest());
        body["model"] = model;

        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync(BaseUrl, body)).StatusCode);
    }

    [Fact]
    public async Task Create_ModelTooLong_Returns400()
    {
        var response = await _client.PostAsJsonAsync(BaseUrl, ValidRequest(model: new string('m', 101)));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("effectiveFrom")]
    [InlineData("inputPrice")]
    [InlineData("outputPrice")]
    [InlineData("cacheWritePrice")]
    [InlineData("cacheReadPrice")]
    public async Task Create_MissingRequiredField_Returns400(string field)
    {
        var body = ToJson(ValidRequest());
        body.Remove(field);

        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync(BaseUrl, body)).StatusCode);
        Assert.Equal(3, _factory.ModelPrices.Items.Count);
    }

    [Theory]
    [InlineData("inputPrice")]
    [InlineData("outputPrice")]
    [InlineData("cacheWritePrice")]
    [InlineData("cacheReadPrice")]
    public async Task Create_NegativePrice_Returns400(string field)
    {
        var body = ToJson(ValidRequest());
        body[field] = -0.01m;

        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync(BaseUrl, body)).StatusCode);
    }

    [Fact]
    public async Task Create_ZeroPrices_AreAllowed()
    {
        var response = await _client.PostAsJsonAsync(BaseUrl, ValidRequest(input: 0, output: 0, cacheWrite: 0, cacheRead: 0));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    // ---- Update / delete ----

    [Fact]
    public async Task Update_Valid_Returns204_AndSaves()
    {
        var response = await _client.PutAsJsonAsync(BaseUrl, ValidRequest(pkid: 2, model: " claude-sonnet-5-5 ", effectiveFrom: Seeded, input: 3));

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var saved = _factory.ModelPrices.Items.Single(i => i.Pkid == 2);
        Assert.Equal("claude-sonnet-5-5", saved.Model);
        Assert.Equal(3m, saved.InputPrice);
    }

    [Fact]
    public async Task Update_SameRowKeepsItsOwnKey_IsNotADuplicate()
    {
        var response = await _client.PutAsJsonAsync(BaseUrl, ValidRequest(pkid: 1, model: "claude-opus-5-5", effectiveFrom: Seeded));

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task Update_ToAnotherRowsModelAndDate_Returns409()
    {
        var response = await _client.PutAsJsonAsync(BaseUrl, ValidRequest(pkid: 2, model: "claude-opus-5-5", effectiveFrom: Seeded));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Equal("此模型在該生效日已有定價", json!["message"]);
        Assert.Equal("claude-sonnet-5-5", _factory.ModelPrices.Items.Single(i => i.Pkid == 2).Model);
    }

    [Fact]
    public async Task Update_Missing_Returns404()
    {
        Assert.Equal(HttpStatusCode.NotFound, (await _client.PutAsJsonAsync(BaseUrl, ValidRequest(pkid: 99))).StatusCode);
    }

    [Fact]
    public async Task Delete_Existing_Returns204_AndRemoves()
    {
        var response = await _client.DeleteAsync($"{BaseUrl}/3");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.DoesNotContain(_factory.ModelPrices.Items, i => i.Pkid == 3);
    }

    [Fact]
    public async Task Delete_Missing_Returns404()
    {
        Assert.Equal(HttpStatusCode.NotFound, (await _client.DeleteAsync($"{BaseUrl}/99")).StatusCode);
    }

    // ---- Cost recompute ----

    [Fact]
    public async Task Create_PricesExistingUsageOfThatModel_FromItsEffectiveDate()
    {
        await SubmitMillion("s-1", new(2026, 9, 30), "claude-new");
        await SubmitMillion("s-2", new(2026, 10, 1), "claude-new");
        await SubmitMillion("s-3", new(2026, 10, 1), "claude-sonnet-5-5");

        await _client.PostAsJsonAsync(BaseUrl, ValidRequest(model: "claude-new", effectiveFrom: new(2026, 10, 1)));

        Assert.Equal(
            [
                (new DateOnly(2026, 10, 1), "claude-new", (decimal?)40.5m),
                (new DateOnly(2026, 10, 1), "claude-sonnet-5-5", 16.2m),
                (new DateOnly(2026, 9, 30), "claude-new", null),
            ],
            await Costs());
    }

    [Fact]
    public async Task Create_LaterPrice_RepricesOnlyRowsFromThatDay()
    {
        await SubmitMillion("s-1", new(2026, 9, 30), "claude-opus-5-5");
        await SubmitMillion("s-2", new(2026, 10, 1), "claude-opus-5-5");

        await _client.PostAsJsonAsync(BaseUrl, ValidRequest(model: "claude-opus-5-5", effectiveFrom: new(2026, 10, 1)));

        Assert.Equal(
            [
                (new DateOnly(2026, 10, 1), "claude-opus-5-5", (decimal?)40.5m),
                (new DateOnly(2026, 9, 30), "claude-opus-5-5", 32.2m),
            ],
            await Costs());
    }

    [Fact]
    public async Task Update_Price_RepricesUsageOfThatModel()
    {
        await SubmitMillion("s-1", new(2026, 10, 1), "claude-opus-5-5");
        await SubmitMillion("s-2", new(2026, 10, 1), "claude-haiku-5-5");

        await _client.PutAsJsonAsync(BaseUrl, ValidRequest(pkid: 1, model: "claude-opus-5-5", effectiveFrom: Seeded,
            input: 1, output: 2, cacheWrite: 3, cacheRead: 4));

        Assert.Equal(
            [
                (new DateOnly(2026, 10, 1), "claude-haiku-5-5", (decimal?)0.81m),
                (new DateOnly(2026, 10, 1), "claude-opus-5-5", 10m),
            ],
            await Costs());
    }

    [Fact]
    public async Task Update_LaterEffectiveFrom_UnpricesRowsBeforeIt()
    {
        await SubmitMillion("s-1", new(2026, 9, 30), "claude-opus-5-5");
        await SubmitMillion("s-2", new(2026, 10, 1), "claude-opus-5-5");

        await _client.PutAsJsonAsync(BaseUrl, ValidRequest(pkid: 1, model: "claude-opus-5-5", effectiveFrom: new(2026, 10, 1),
            input: 4, output: 20, cacheWrite: 8, cacheRead: 0.2m));

        Assert.Equal(
            [
                (new DateOnly(2026, 10, 1), "claude-opus-5-5", (decimal?)32.2m),
                (new DateOnly(2026, 9, 30), "claude-opus-5-5", null),
            ],
            await Costs());
    }

    [Fact]
    public async Task Update_ModelRename_RepricesBothOldAndNewModel()
    {
        await SubmitMillion("s-1", new(2026, 10, 1), "claude-opus-5-5");
        await SubmitMillion("s-2", new(2026, 10, 1), "claude-renamed");

        await _client.PutAsJsonAsync(BaseUrl, ValidRequest(pkid: 1, model: "claude-renamed", effectiveFrom: Seeded,
            input: 1, output: 1, cacheWrite: 1, cacheRead: 1));

        Assert.Equal(
            [
                (new DateOnly(2026, 10, 1), "claude-opus-5-5", (decimal?)null),
                (new DateOnly(2026, 10, 1), "claude-renamed", 4m),
            ],
            await Costs());
    }

    [Fact]
    public async Task Delete_LaterPrice_FallsBackToEarlierPrice()
    {
        var created = await _client.PostAsJsonAsync(BaseUrl, ValidRequest(model: "claude-opus-5-5", effectiveFrom: new(2026, 10, 1)));
        var pkid = (await created.Content.ReadFromJsonAsync<ModelPrice>())!.Pkid;
        await SubmitMillion("s-1", new(2026, 10, 1), "claude-opus-5-5");
        Assert.Equal(40.5m, (await Costs()).Single().Item3);

        await _client.DeleteAsync($"{BaseUrl}/{pkid}");

        Assert.Equal(32.2m, (await Costs()).Single().Item3);
    }

    [Fact]
    public async Task Delete_OnlyPrice_LeavesUsageUnpriced()
    {
        await SubmitMillion("s-1", new(2026, 10, 1), "claude-haiku-5-5");
        await SubmitMillion("s-2", new(2026, 10, 1), "claude-sonnet-5-5");

        await _client.DeleteAsync($"{BaseUrl}/3");

        Assert.Equal(
            [
                (new DateOnly(2026, 10, 1), "claude-haiku-5-5", (decimal?)null),
                (new DateOnly(2026, 10, 1), "claude-sonnet-5-5", 16.2m),
            ],
            await Costs());
    }

    [Fact]
    public async Task Create_Duplicate_LeavesCostsUnchanged()
    {
        await SubmitMillion("s-1", new(2026, 10, 1), "claude-opus-5-5");

        await _client.PostAsJsonAsync(BaseUrl, ValidRequest(model: "claude-opus-5-5", effectiveFrom: Seeded, input: 100));

        Assert.Equal(32.2m, (await Costs()).Single().Item3);
    }
}

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using CMS.API.Models;
using CMS.API.Tests.Infrastructure;

namespace CMS.API.Tests;

public class FeaturedPromoItemsControllerTests : IDisposable
{
    private const string BaseUrl = "/api/featured-promo-items";

    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client;

    public FeaturedPromoItemsControllerTests()
    {
        _client = _factory.CreateClient();
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    // Wednesday 2026-03-18 has no rows for 台北 yet
    private static FeaturedPromoItemRequest ValidRequest(int pkid = 0) => new()
    {
        Pkid = pkid,
        ScheduleOn = new DateOnly(2026, 3, 18),
        TrainingCenterPkid = 1,
        Slot = 1,
        PromotionPkid = 4,
        Topic = "教你把AI變成實戰力",
        Description = "用GitHub Copilot快速提升效率",
    };

    // ---- List ----

    [Fact]
    public async Task GetAll_ReturnsAllItems_SortedByDateThenCenterThenSlot_WithNavObjects()
    {
        var items = await _client.GetFromJsonAsync<List<FeaturedPromoItem>>(BaseUrl);

        Assert.NotNull(items);
        Assert.Equal([1, 2, 3, 4, 5, 6], items.Select(i => i.Pkid));
        var monday = items.Single(i => i.Pkid == 3);
        Assert.Equal("台北", monday.TrainingCenter?.Name);
        Assert.Equal("251211_GoogleAI", monday.Promotion?.PromoCode);
    }

    [Fact]
    public async Task GetAll_SerializesPromoCodeAndDateForTheSchedulePage()
    {
        var json = await _client.GetStringAsync(BaseUrl);
        var second = JsonNode.Parse(json)!.AsArray()[1]!;

        Assert.Equal("2026-03-16", (string?)second["scheduleOn"]);
        Assert.Equal(1, (int?)second["slot"]);
        Assert.Equal("20251204_SkillTrainAI", (string?)second["promotion"]?["promoCode"]);
    }

    [Fact]
    public async Task Query_EmptyFilter_ReturnsAll()
    {
        var items = await PostQuery(new FeaturedPromoItemQuery());

        Assert.Equal(6, items.Count);
    }

    // ---- One-week ScheduleOn filter ----

    [Theory]
    [InlineData(2026, 3, 16)] // Monday
    [InlineData(2026, 3, 18)] // Wednesday
    [InlineData(2026, 3, 22)] // Sunday
    public async Task Query_ByWeekOf_ReturnsMondayToSundayOfThatWeek(int y, int m, int d)
    {
        var items = await PostQuery(new FeaturedPromoItemQuery { WeekOf = new DateOnly(y, m, d) });

        // Excludes Sun 3/15 (pkid 1) and Mon 3/23 (pkid 6)
        Assert.Equal([2, 3, 4, 5], items.Select(i => i.Pkid));
    }

    [Fact]
    public async Task Query_ByWeekOf_PreviousAndNextWeeks()
    {
        var previous = await PostQuery(new FeaturedPromoItemQuery { WeekOf = new DateOnly(2026, 3, 15) });
        var next = await PostQuery(new FeaturedPromoItemQuery { WeekOf = new DateOnly(2026, 3, 23) });

        Assert.Equal([1], previous.Select(i => i.Pkid));
        Assert.Equal([6], next.Select(i => i.Pkid));
    }

    [Fact]
    public async Task Query_ByWeekOf_EmptyWeek_ReturnsNothing()
    {
        var items = await PostQuery(new FeaturedPromoItemQuery { WeekOf = new DateOnly(2026, 4, 1) });

        Assert.Empty(items);
    }

    [Theory]
    [InlineData("2026-03-16", "2026-03-16")]
    [InlineData("2026-03-18", "2026-03-16")]
    [InlineData("2026-03-22", "2026-03-16")]
    [InlineData("2026-03-23", "2026-03-23")]
    [InlineData("2026-01-01", "2025-12-29")] // week spans the year boundary
    public void WeekStart_ReturnsMonday(string date, string expectedMonday)
    {
        Assert.Equal(DateOnly.Parse(expectedMonday), FeaturedPromoItemQuery.WeekStart(DateOnly.Parse(date)));
    }

    // ---- TrainingCenter filter ----

    [Theory]
    [InlineData(1, new[] { 1, 2, 3, 5, 6 })]
    [InlineData(2, new[] { 4 })]
    [InlineData(3, new int[0])]
    public async Task Query_ByTrainingCenter(short trainingCenterPkid, int[] expected)
    {
        var items = await PostQuery(new FeaturedPromoItemQuery { TrainingCenterPkid = trainingCenterPkid });

        Assert.Equal(expected, items.Select(i => i.Pkid));
        Assert.All(items, i => Assert.Equal(trainingCenterPkid, i.TrainingCenterPkid));
    }

    [Fact]
    public async Task Query_ByTrainingCenterAndWeek_AreAnded()
    {
        var taipei = await PostQuery(new FeaturedPromoItemQuery { TrainingCenterPkid = 1, WeekOf = new DateOnly(2026, 3, 19) });
        var hsinchu = await PostQuery(new FeaturedPromoItemQuery { TrainingCenterPkid = 2, WeekOf = new DateOnly(2026, 3, 19) });

        Assert.Equal([2, 3, 5], taipei.Select(i => i.Pkid));
        Assert.Equal([4], hsinchu.Select(i => i.Pkid));
    }

    // ---- View ----

    [Fact]
    public async Task GetById_Existing_ReturnsItem()
    {
        var item = await _client.GetFromJsonAsync<FeaturedPromoItem>($"{BaseUrl}/4");

        Assert.NotNull(item);
        Assert.Equal(new DateOnly(2026, 3, 16), item.ScheduleOn);
        Assert.Equal("新竹", item.TrainingCenter?.Name);
        Assert.Equal(3, item.PromotionPkid);
        Assert.Equal("20251215_n8n", item.Promotion?.PromoCode);
    }

    [Fact]
    public async Task GetById_Missing_Returns404()
    {
        var response = await _client.GetAsync($"{BaseUrl}/99");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ---- Add ----

    [Fact]
    public async Task Create_Valid_Returns201_WithIdentityPkid_PromoCodeAndTrimmedValues()
    {
        var request = ValidRequest();
        request.Topic = "  教你把AI變成實戰力  ";

        var response = await _client.PostAsJsonAsync(BaseUrl, request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<FeaturedPromoItem>();
        Assert.NotNull(created);
        Assert.Equal(7, created.Pkid);
        Assert.Equal("教你把AI變成實戰力", created.Topic);
        Assert.Equal("240614_MSAI", created.Promotion?.PromoCode);
        Assert.Equal("台北", created.TrainingCenter?.Name);
        Assert.Equal("/api/featured-promo-items/7", response.Headers.Location?.AbsolutePath, ignoreCase: true);
    }

    [Fact]
    public async Task Create_IgnoresPkidInBody()
    {
        var response = await _client.PostAsJsonAsync(BaseUrl, ValidRequest(pkid: 2));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(7, (await response.Content.ReadFromJsonAsync<FeaturedPromoItem>())!.Pkid);
        Assert.Equal(1, (await _client.GetFromJsonAsync<FeaturedPromoItem>($"{BaseUrl}/2"))!.PromotionPkid);
    }

    [Fact]
    public async Task Create_SameSlotOtherTrainingCenter_IsAllowed()
    {
        var request = ValidRequest();
        request.ScheduleOn = new DateOnly(2026, 3, 16);
        request.TrainingCenterPkid = 3; // 台北 and 新竹 already have slot 1 that day

        var response = await _client.PostAsJsonAsync(BaseUrl, request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task Create_SlotAlreadyTaken_Returns409_WithMessage()
    {
        var request = ValidRequest();
        request.ScheduleOn = new DateOnly(2026, 3, 16);
        request.Slot = 2;

        var response = await _client.PostAsJsonAsync(BaseUrl, request);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Contains("第 2 則已有資料", json!["message"]);
    }

    [Theory]
    [InlineData("topic")]
    [InlineData("description")]
    public async Task Create_MissingRequiredString_Returns400(string field)
    {
        var body = ToJson(ValidRequest());
        body[field] = "";

        var response = await _client.PostAsJsonAsync(BaseUrl, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("topic", 101)]
    [InlineData("description", 301)]
    public async Task Create_FieldTooLong_Returns400(string field, int length)
    {
        var body = ToJson(ValidRequest());
        body[field] = new string('x', length);

        var response = await _client.PostAsJsonAsync(BaseUrl, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_MissingScheduleOn_Returns400()
    {
        var body = ToJson(ValidRequest());
        body.Remove("scheduleOn");

        var response = await _client.PostAsJsonAsync(BaseUrl, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("slot", 0)]
    [InlineData("slot", 4)]
    [InlineData("trainingCenterPkid", 0)]
    [InlineData("promotionPkid", 0)]
    public async Task Create_OutOfRangeNumber_Returns400(string field, int value)
    {
        var body = ToJson(ValidRequest());
        body[field] = value;

        var response = await _client.PostAsJsonAsync(BaseUrl, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("trainingCenterPkid", 99)]
    [InlineData("promotionPkid", 99)]
    public async Task Create_UnknownForeignKey_Returns400_WithMessage(string field, int value)
    {
        var body = ToJson(ValidRequest());
        body[field] = value;

        var response = await _client.PostAsJsonAsync(BaseUrl, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Contains("不存在", json!["message"]);
    }

    // ---- Edit ----

    [Fact]
    public async Task Update_Existing_Returns204_AndAppliesChanges()
    {
        var request = ValidRequest(pkid: 3);
        request.ScheduleOn = new DateOnly(2026, 3, 16);
        request.Slot = 2;
        request.PromotionPkid = 3;
        request.Topic = " n8n自動化三部曲 ";

        var response = await _client.PutAsJsonAsync(BaseUrl, request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var fetched = await _client.GetFromJsonAsync<FeaturedPromoItem>($"{BaseUrl}/3");
        Assert.Equal("20251215_n8n", fetched!.Promotion?.PromoCode);
        Assert.Equal("n8n自動化三部曲", fetched.Topic);
    }

    [Fact]
    public async Task Update_Missing_Returns404()
    {
        var response = await _client.PutAsJsonAsync(BaseUrl, ValidRequest(pkid: 99));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Update_IntoTakenSlot_Returns409_AndLeavesRowUnchanged()
    {
        var request = ValidRequest(pkid: 3);
        request.ScheduleOn = new DateOnly(2026, 3, 16);
        request.Slot = 1; // pkid 2

        var response = await _client.PutAsJsonAsync(BaseUrl, request);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(2, (await _client.GetFromJsonAsync<FeaturedPromoItem>($"{BaseUrl}/3"))!.Slot);
    }

    [Fact]
    public async Task Update_UnknownPromotion_Returns400()
    {
        var request = ValidRequest(pkid: 3);
        request.PromotionPkid = 99;

        var response = await _client.PutAsJsonAsync(BaseUrl, request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ---- Move slot (+ / −) ----

    [Fact]
    public async Task MoveDown_SwapsWithTheNextSlot()
    {
        var response = await _client.PostAsync($"{BaseUrl}/2/move-down", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(2, (await GetSlot(2)));
        Assert.Equal(1, (await GetSlot(3)));
        Assert.Equal(1, (await GetSlot(4))); // other training center untouched
    }

    [Fact]
    public async Task MoveDown_IntoEmptySlot_JustMoves()
    {
        var response = await _client.PostAsync($"{BaseUrl}/3/move-down", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(3, await GetSlot(3));
        Assert.Equal(1, await GetSlot(2));
    }

    [Fact]
    public async Task MoveUp_SwapsWithThePreviousSlot()
    {
        var response = await _client.PostAsync($"{BaseUrl}/3/move-up", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(1, await GetSlot(3));
        Assert.Equal(2, await GetSlot(2));
    }

    [Fact]
    public async Task MoveUp_FromFirstSlot_Returns400()
    {
        var response = await _client.PostAsync($"{BaseUrl}/2/move-up", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(1, await GetSlot(2));
    }

    [Fact]
    public async Task MoveDown_FromLastSlot_Returns400()
    {
        var response = await _client.PostAsync($"{BaseUrl}/5/move-down", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(3, await GetSlot(5));
    }

    [Theory]
    [InlineData("move-up")]
    [InlineData("move-down")]
    public async Task Move_Missing_Returns404(string action)
    {
        var response = await _client.PostAsync($"{BaseUrl}/99/{action}", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
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

    // ---- Lookups ----

    [Fact]
    public async Task TrainingCenterLookup_ReturnsPkidAndName_SortedByDisplayOrder()
    {
        var items = await _client.GetFromJsonAsync<List<TrainingCenterLookup>>("/api/lookups/training-centers");

        Assert.NotNull(items);
        Assert.Equal(["台北", "新竹", "台中", "高雄"], items.Select(t => t.Name));
        Assert.Equal([(short)1, (short)2, (short)3, (short)5], items.Select(t => t.Pkid));
    }

    [Fact]
    public async Task PromotionLookup_ByKeyword_ReturnsPkidPromoCodeTopicAndDescription()
    {
        var items = await GetPromotions("?keyword=GoogleAI");

        var promo = Assert.Single(items);
        Assert.Equal(2, promo.Pkid);
        Assert.Equal("251211_GoogleAI", promo.PromoCode);
        Assert.Equal("Google AI工具一次掌握", promo.Topic);
        Assert.StartsWith("不需技術基礎", promo.Description);
    }

    [Fact]
    public async Task PromotionLookup_IsCaseInsensitive_AndTrimsTheKeyword()
    {
        var items = await GetPromotions("?keyword=%20%20n8N%20");

        Assert.Equal([3], items.Select(p => p.Pkid));
    }

    [Fact]
    public async Task PromotionLookup_SameRank_NewestFirst()
    {
        // No code starts with "AI", so all matches rank equally
        var mid = await GetPromotions("?keyword=AI");
        // Both codes start with "20251"
        var prefix = await GetPromotions("?keyword=20251");

        Assert.Equal([4, 2, 1], mid.Select(p => p.Pkid));
        Assert.Equal([3, 1], prefix.Select(p => p.Pkid));
    }

    [Fact]
    public async Task PromotionLookup_PrefixMatchRanksAboveNewerMidMatch()
    {
        var items = await GetPromotions("?keyword=25");

        // pkid 2 "251211_…" starts with "25"; newer pkid 3 "20251215_…" and pkid 1 only contain it
        Assert.Equal([2, 3, 1], items.Select(p => p.Pkid));
    }

    [Fact]
    public async Task PromotionLookup_NoKeyword_ReturnsNewestFirst_LimitedByTake()
    {
        var items = await GetPromotions("?take=2");

        Assert.Equal([4, 3], items.Select(p => p.Pkid));
    }

    [Fact]
    public async Task PromotionLookup_NoMatch_ReturnsEmpty()
    {
        Assert.Empty(await GetPromotions("?keyword=zzz"));
    }

    private static JsonObject ToJson(FeaturedPromoItemRequest r)
        => JsonSerializer.SerializeToNode(r, JsonSerializerOptions.Web)!.AsObject();

    private async Task<List<FeaturedPromoItem>> PostQuery(FeaturedPromoItemQuery query)
    {
        var response = await _client.PostAsJsonAsync($"{BaseUrl}/query", query);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<List<FeaturedPromoItem>>())!;
    }

    private async Task<byte> GetSlot(int pkid)
        => (await _client.GetFromJsonAsync<FeaturedPromoItem>($"{BaseUrl}/{pkid}"))!.Slot;

    private async Task<List<PromotionLookup>> GetPromotions(string queryString)
        => (await _client.GetFromJsonAsync<List<PromotionLookup>>($"/api/lookups/promotions{queryString}"))!;
}

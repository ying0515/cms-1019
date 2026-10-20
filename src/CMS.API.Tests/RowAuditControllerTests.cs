using System.Net;
using System.Net.Http.Json;
using CMS.API.Data;
using CMS.API.Models;
using CMS.API.Tests.Infrastructure;
using Dapper;
using Microsoft.Extensions.Configuration;

namespace CMS.API.Tests;

/// <summary>
/// GET /api/rowaudit with the real RowAuditRepository (CmsApiFactory does not swap it), so filtering and
/// ordering are the SQL's. Rows are seeded under a table name unique to this test run and deleted afterwards.
/// </summary>
[Trait("Category", "Database")]
public class RowAuditControllerTests : IAsyncLifetime
{
    private const string BaseUrl = "/api/rowaudit";

    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client;
    private readonly SqlConnectionFactory _db = new(new ConfigurationBuilder()
        .SetBasePath(AppContext.BaseDirectory)
        .AddJsonFile("appsettings.json")
        .Build());

    // varchar(50): unique per run so parallel runs and real audit rows never collide
    private readonly string _table = $"ZzAuditTest{Guid.NewGuid():N}"[..30];
    private readonly string _otherTable = $"ZzAuditTest{Guid.NewGuid():N}"[..30];

    public RowAuditControllerTests()
    {
        _client = _factory.CreateClient();
    }

    public async Task InitializeAsync()
    {
        // Inserted out of date order; the 10:00 pair shares a DateTime, so pkid (insert order) breaks the tie.
        await SeedAsync(_table, "7", "Update", "Title", new DateTime(2026, 6, 4, 9, 0, 0), "alice");
        await SeedAsync(_table, "7", "Insert", "雲端課程", new DateTime(2026, 6, 1, 8, 0, 0), "helen");
        await SeedAsync(_table, "7", "Update", "Hour", new DateTime(2026, 6, 5, 10, 0, 0), "bob");
        await SeedAsync(_table, "7", "Update", "Note", new DateTime(2026, 6, 5, 10, 0, 0), "bob");
        // Same table, other record; other table, same pkid
        await SeedAsync(_table, "8", "Insert", "其他課程", new DateTime(2026, 6, 9, 0, 0, 0), "helen");
        await SeedAsync(_otherTable, "7", "Insert", "別的表", new DateTime(2026, 6, 9, 0, 0, 0), "helen");
    }

    public async Task DisposeAsync()
    {
        using (var conn = await _db.CreateOpenConnectionAsync())
            await conn.ExecuteAsync("DELETE FROM RowAudit WHERE TableName IN @tables",
                new { tables = new[] { _table, _otherTable } });
        _client.Dispose();
        await _factory.DisposeAsync();
    }

    private async Task SeedAsync(string table, string pkid, string action, string desc, DateTime at, string user)
    {
        using var conn = await _db.CreateOpenConnectionAsync();
        await conn.ExecuteAsync("""
            INSERT INTO RowAudit (TableName, UserName, PrimaryKeyValues, ActionType, ActionDesc, [DateTime])
            VALUES (@table, @user, @pkid, @action, @desc, @at)
            """, new { table, user, pkid, action, desc, at });
    }

    [Fact]
    public async Task Get_ReturnsOnlyThatRecordsRows_NewestFirst()
    {
        var rows = await _client.GetFromJsonAsync<List<RowAuditEntry>>($"{BaseUrl}?tableName={_table}&pkid=7");

        Assert.NotNull(rows);
        Assert.Equal(["Note", "Hour", "Title", "雲端課程"], rows.Select(r => r.ActionDesc));
        Assert.Equal(["Update", "Update", "Update", "Insert"], rows.Select(r => r.ActionType));
        Assert.Equal(["bob", "bob", "alice", "helen"], rows.Select(r => r.UserName));
        Assert.Equal(new DateTime(2026, 6, 5, 10, 0, 0), rows[0].DateTime);
    }

    [Fact]
    public async Task Get_RecordWithoutHistory_ReturnsEmptyList()
    {
        var rows = await _client.GetFromJsonAsync<List<RowAuditEntry>>($"{BaseUrl}?tableName={_table}&pkid=999");

        Assert.NotNull(rows);
        Assert.Empty(rows);
    }

    [Fact]
    public async Task Get_ReturnsOnlyTheFourHistoryFields()
    {
        var json = await _client.GetStringAsync($"{BaseUrl}?tableName={_otherTable}&pkid=7");

        Assert.Equal("""[{"dateTime":"2026-06-09T00:00:00","userName":"helen","actionType":"Insert","actionDesc":"別的表"}]""",
            json);
    }

    [Theory]
    [InlineData("?pkid=7")]
    [InlineData("?tableName=Course")]
    [InlineData("?tableName=%20&pkid=7")]
    public async Task Get_MissingTableNameOrPkid_Returns400(string query)
    {
        var response = await _client.GetAsync(BaseUrl + query);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Get_WithoutToken_Returns401()
    {
        _client.DefaultRequestHeaders.Authorization = null;

        var response = await _client.GetAsync($"{BaseUrl}?tableName={_table}&pkid=7");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}

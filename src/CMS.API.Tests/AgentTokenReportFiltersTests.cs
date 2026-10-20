using System.Net.Http.Json;
using CMS.API.Models;
using CMS.API.Tests.Infrastructure;

namespace CMS.API.Tests;

/// <summary>Report user / project / model filters and the lookups that feed the filter drawer.</summary>
public class AgentTokenReportFiltersTests : IDisposable
{
    private const string BaseUrl = "/api/agent-token-usage";
    private const string ReportUrl = "/api/agent-token-usage/report";

    // CmsApiFactory pins the clock to 2026-10-20 11:00 in Taipei
    private static readonly DateOnly Today = new(2026, 10, 20);

    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client;

    public AgentTokenReportFiltersTests()
    {
        _client = _factory.CreateClient();
        _client.DefaultRequestHeaders.Add("X-Api-Key", CmsApiFactory.ApiKey);
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    private Task Submit(string sessionId, string userId, string project, params string[] models)
        => SubmitOn(Today, sessionId, userId, project, models);

    private async Task SubmitOn(DateOnly date, string sessionId, string userId, string project, params string[] models)
    {
        var response = await _client.PostAsJsonAsync(BaseUrl, new AgentTokenUsageSubmitRequest
        {
            SessionId = sessionId,
            UserId = userId,
            Project = project,
            Items = [.. models.Select(m => new AgentTokenUsageItem { UsageDate = date, Model = m, InputTokens = 1 })],
        });
        response.EnsureSuccessStatusCode();
    }

    /// <summary>jenny and helen across two projects and two models.</summary>
    private async Task SeedUsage()
    {
        await Submit("s-1", "jenny", "cms-1019", "claude-opus-5-5", "claude-haiku-5-5");
        await Submit("s-2", "jenny", "other-repo", "claude-opus-5-5");
        await Submit("s-3", "helen", "cms-1019", "claude-opus-5-5");
        await Submit("s-4", "helen", "other-repo", "claude-haiku-5-5");
    }

    private async Task<List<(string UserId, string Project, string Model)>> Report(AgentTokenUsageReportQuery query)
    {
        var response = await _client.PostAsJsonAsync(ReportUrl, query);
        response.EnsureSuccessStatusCode();
        var rows = (await response.Content.ReadFromJsonAsync<List<AgentTokenUsageReportRow>>())!;
        return rows.Select(r => (r.UserId, r.Project, r.Model)).ToList();
    }

    // ---- Report filters ----

    [Fact]
    public async Task Report_FiltersByUser()
    {
        await SeedUsage();

        Assert.Equal(
            [("helen", "cms-1019", "claude-opus-5-5"), ("helen", "other-repo", "claude-haiku-5-5")],
            await Report(new() { UserId = "helen" }));
    }

    [Fact]
    public async Task Report_FiltersByProject()
    {
        await SeedUsage();

        Assert.Equal(
            [("helen", "other-repo", "claude-haiku-5-5"), ("jenny", "other-repo", "claude-opus-5-5")],
            await Report(new() { Project = "other-repo" }));
    }

    [Fact]
    public async Task Report_FiltersByModel()
    {
        await SeedUsage();

        Assert.Equal(
            [("helen", "other-repo", "claude-haiku-5-5"), ("jenny", "cms-1019", "claude-haiku-5-5")],
            await Report(new() { Model = "claude-haiku-5-5" }));
    }

    [Fact]
    public async Task Report_CombinesAllFilters()
    {
        await SeedUsage();
        await SubmitOn(Today.AddDays(-1), "s-old", "jenny", "cms-1019", "claude-opus-5-5");

        Assert.Equal(
            [("jenny", "cms-1019", "claude-opus-5-5")],
            await Report(new()
            {
                UsageDateFrom = Today,
                UsageDateTo = Today,
                UserId = "jenny",
                Project = "cms-1019",
                Model = "claude-opus-5-5",
            }));
        Assert.Empty(await Report(new() { UserId = "jenny", Project = "cms-1019", Model = "claude-sonnet-5-5" }));
        Assert.Empty(await Report(new() { UsageDateTo = Today.AddDays(-1), UserId = "helen" }));
    }

    [Fact]
    public async Task Report_BlankFilters_MeanAll()
    {
        await SeedUsage();

        Assert.Equal(5, (await Report(new() { UserId = " ", Project = "", Model = null })).Count);
    }

    // ---- Lookups ----

    [Fact]
    public async Task ProjectsLookup_ReturnsDistinctProjects_Sorted()
    {
        await Submit("s-1", "jenny", "zeta", "claude-opus-5-5");
        await Submit("s-2", "helen", "cms-1019", "claude-opus-5-5");
        await Submit("s-3", "jenny", "zeta", "claude-haiku-5-5");
        await SubmitOn(Today.AddDays(-30), "s-4", "helen", "alpha", "claude-opus-5-5");

        var projects = await _client.GetFromJsonAsync<List<string>>("/api/lookups/agent-token-projects");

        Assert.Equal(["alpha", "cms-1019", "zeta"], projects);
    }

    [Fact]
    public async Task ModelsLookup_ReturnsDistinctModels_Sorted()
    {
        await Submit("s-1", "jenny", "cms-1019", "claude-sonnet-5-5", "claude-haiku-5-5");
        await Submit("s-2", "helen", "other-repo", "claude-sonnet-5-5", "claude-opus-5-5");

        var models = await _client.GetFromJsonAsync<List<string>>("/api/lookups/agent-token-models");

        Assert.Equal(["claude-haiku-5-5", "claude-opus-5-5", "claude-sonnet-5-5"], models);
    }

    [Fact]
    public async Task Lookups_NoUsage_ReturnEmpty()
    {
        Assert.Empty((await _client.GetFromJsonAsync<List<string>>("/api/lookups/agent-token-projects"))!);
        Assert.Empty((await _client.GetFromJsonAsync<List<string>>("/api/lookups/agent-token-models"))!);
    }
}

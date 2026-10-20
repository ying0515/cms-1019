using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using CMS.API.Middleware;
using CMS.API.Models;
using CMS.API.Repositories;
using CMS.API.Tests.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;

namespace CMS.API.Tests;

/// <summary>
/// ExceptionHandlingMiddleware: an unhandled exception becomes one generic 500 JSON body (logged in full),
/// while 401 / 403 / 400 / 409 keep their existing responses.
/// </summary>
public class ExceptionHandlingTests : IDisposable
{
    // What a real failure could leak: SQL text, connection details, the exception type and stack frames
    private const string LeakyMessage =
        "Invalid object name 'CourseGroup'. SELECT g.pkid, g.Description FROM CourseGroup g; "
        + @"Server=.\SQLEXPRESS;Database=CMS;Password=secret";

    private readonly CmsApiFactory _factory = new();
    private readonly CapturingLoggerProvider _logs = new();

    public void Dispose() => _factory.Dispose();

    /// <summary>A client whose CourseGroup repository throws (and, optionally, whose SysConfig read throws).</summary>
    private HttpClient ThrowingClient(string environment = "Testing", bool failSigningKeyRead = false)
    {
        var client = _factory.WithWebHostBuilder(b =>
        {
            b.UseEnvironment(environment);
            b.ConfigureLogging(logging => logging.AddProvider(_logs));
            b.ConfigureTestServices(services =>
            {
                services.RemoveAll<ICourseGroupRepository>();
                services.AddSingleton<ICourseGroupRepository>(new ThrowingCourseGroupRepository());
                if (failSigningKeyRead)
                {
                    services.RemoveAll<ISysConfigRepository>();
                    services.AddSingleton<ISysConfigRepository>(new ThrowingSysConfigRepository());
                }
            });
        }).CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", CmsApiFactory.TokenFor());
        return client;
    }

    private static void AssertSafe500(HttpResponseMessage response, string body)
    {
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);

        using var json = JsonDocument.Parse(body);
        var props = json.RootElement.EnumerateObject().Select(p => p.Name).ToArray();
        Assert.Equal(["message", "traceId"], props);
        Assert.Equal(ExceptionHandlingMiddleware.SafeMessage, json.RootElement.GetProperty("message").GetString());
        Assert.False(string.IsNullOrWhiteSpace(json.RootElement.GetProperty("traceId").GetString()));

        foreach (var leak in new[] { "SELECT", "SQLEXPRESS", "Password", "Exception", "ThrowingCourseGroupRepository", " at " })
            Assert.DoesNotContain(leak, body);
    }

    // ---- Unhandled exceptions → generic 500 ----

    [Theory]
    [InlineData("Testing")]
    [InlineData("Development")] // the developer exception page must not get there first
    [InlineData("Production")]
    public async Task ThrowingRepository_Returns500WithOnlyTheGenericMessage(string environment)
    {
        using var client = ThrowingClient(environment);

        var response = await client.GetAsync("/api/course-groups");

        AssertSafe500(response, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task ThrowingRepository_OnWrite_Returns500()
    {
        using var client = ThrowingClient();

        var response = await client.PostAsJsonAsync("/api/course-groups", new CourseGroupRequest { Description = "雲端" });

        AssertSafe500(response, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task UnhandledException_IsLoggedInFullWithTheResponsesTraceId()
    {
        using var client = ThrowingClient();

        var response = await client.GetAsync("/api/course-groups");
        var traceId = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("traceId").GetString()!;

        var entry = Assert.Single(_logs.Entries,
            e => e.Category == typeof(ExceptionHandlingMiddleware).FullName && e.Level == LogLevel.Error);
        Assert.Contains("GET /api/course-groups", entry.Message);
        Assert.Contains(traceId, entry.Message);
        var ex = Assert.IsType<InvalidOperationException>(entry.Exception);
        Assert.Equal(LeakyMessage, ex.Message);
        Assert.Contains(nameof(ThrowingCourseGroupRepository), ex.StackTrace);
    }

    [Fact]
    public async Task ExceptionDuringAuthentication_Returns500()
    {
        // JwtBearer reads the signing key from SysConfig on every request
        using var client = ThrowingClient(failSigningKeyRead: true);

        var response = await client.GetAsync("/api/course-groups");

        AssertSafe500(response, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Response500_KeepsCorsHeaders_SoTheBrowserCanReadIt()
    {
        using var client = ThrowingClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/course-groups");
        request.Headers.Add("Origin", "http://localhost:4200");

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal("http://localhost:4200", response.Headers.GetValues("Access-Control-Allow-Origin").Single());
    }

    // ---- Meaningful responses are unchanged ----

    [Fact]
    public async Task NoToken_StillReturns401WithoutABody()
    {
        using var client = ThrowingClient();
        client.DefaultRequestHeaders.Authorization = null;

        var response = await client.GetAsync("/api/course-groups");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("", await response.Content.ReadAsStringAsync());
        Assert.DoesNotContain(_logs.Entries, e => e.Category == typeof(ExceptionHandlingMiddleware).FullName);
    }

    [Fact]
    public async Task NonAdmin_StillReturns403()
    {
        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CmsApiFactory.TokenFor("miles", "Miles Sun", "User"));

        var response = await client.PostAsJsonAsync("/api/auth/reset-password", new { userId = "jenny" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task InvalidBody_StillReturnsTheValidationProblem400()
    {
        // Validation runs before the action, so the throwing repository is never reached
        using var client = ThrowingClient();

        var response = await client.PostAsJsonAsync("/api/course-groups", new CourseGroupRequest { Description = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("errors").TryGetProperty("Description", out _));
    }

    [Fact]
    public async Task BusinessConflict_StillReturns409WithItsMessage()
    {
        using var client = _factory.CreateClient();
        await client.PostAsJsonAsync("/api/model-prices", ModelPrice("claude-x"));

        var response = await client.PostAsJsonAsync("/api/model-prices", ModelPrice("claude-x"));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("此模型在該生效日已有定價", body.GetProperty("message").GetString());
    }

    private static ModelPriceRequest ModelPrice(string model) => new()
    {
        Model = model, EffectiveFrom = new DateOnly(2026, 1, 1),
        InputPrice = 1, OutputPrice = 2, CacheWritePrice = 3, CacheReadPrice = 4,
    };

    private sealed class ThrowingCourseGroupRepository : ICourseGroupRepository
    {
        private static Exception Fail() => new InvalidOperationException(LeakyMessage);

        public Task<IEnumerable<CourseGroup>> GetAllAsync() => throw Fail();
        public Task<IEnumerable<CourseGroup>> QueryAsync(CourseGroupQuery query) => throw Fail();
        public Task<CourseGroup?> GetByIdAsync(short pkid) => throw Fail();
        public Task<short> CreateAsync(CourseGroupRequest request) => throw Fail();
        public Task<bool> UpdateAsync(CourseGroupRequest request) => throw Fail();
        public Task<bool> DeleteAsync(short pkid) => throw Fail();
    }

    private sealed class ThrowingSysConfigRepository : ISysConfigRepository
    {
        public Task<string?> GetValueAsync(string configKey) => throw new InvalidOperationException(LeakyMessage);
    }
}

using System.Security.Claims;
using CMS.API.Data;
using CMS.API.Models;
using CMS.API.Repositories;
using CMS.API.Tests.Infrastructure;
using Dapper;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace CMS.API.Tests;

/// <summary>
/// Real repositories against the local CMS database (connection string from CMS.API appsettings.json):
/// each write leaves exactly the expected RowAudit row, and a failed write leaves none.
/// Every row a test creates (business rows and their RowAudit rows) is deleted afterwards.
/// Skip with `dotnet test --filter Category!=Database` when SQL Server is not available.
/// </summary>
[Trait("Category", "Database")]
public class RowAuditRepositoryTests : IAsyncLifetime
{
    private const string Tester = "稽核測試者";
    private static readonly DateTimeOffset Now = new(2026, 10, 20, 3, 4, 5, TimeSpan.Zero);

    private readonly SqlConnectionFactory _db = new(new ConfigurationBuilder()
        .SetBasePath(AppContext.BaseDirectory)
        .AddJsonFile("appsettings.json")
        .Build());

    private readonly RowAuditWriter _audit;
    private readonly List<short> _courseGroups = [];
    private readonly List<int> _courses = [];

    public RowAuditRepositoryTests()
    {
        // Program.cs registers these; this class uses the repositories without booting the app.
        DapperConfig.RegisterTypeHandlers();

        var user = new ClaimsPrincipal(new ClaimsIdentity([new Claim("name", Tester)], authenticationType: "Bearer"));
        var http = new HttpContextAccessor { HttpContext = new DefaultHttpContext { User = user } };
        _audit = new RowAuditWriter(_db, http, new FixedTimeProvider(Now));
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        using var conn = await _db.CreateOpenConnectionAsync();
        var keys = _courseGroups.Select(p => p.ToString()).ToArray();
        await conn.ExecuteAsync("DELETE FROM CourseGroup WHERE pkid IN @_courseGroups", new { _courseGroups });
        await conn.ExecuteAsync(
            "DELETE FROM RowAudit WHERE TableName = 'CourseGroup' AND PrimaryKeyValues IN @keys", new { keys });

        keys = _courses.Select(p => p.ToString()).ToArray();
        await conn.ExecuteAsync("DELETE FROM Course WHERE pkid IN @_courses", new { _courses });
        await conn.ExecuteAsync("DELETE FROM RowAudit WHERE TableName = 'Course' AND PrimaryKeyValues IN @keys", new { keys });
    }

    private async Task<List<RowAudit>> AuditRowsAsync(string table, object pkid)
    {
        using var conn = await _db.CreateOpenConnectionAsync();
        return (await conn.QueryAsync<RowAudit>("""
            SELECT TableName, UserName, PrimaryKeyValues, ActionType, ActionDesc, [DateTime]
            FROM RowAudit WHERE TableName = @table AND PrimaryKeyValues = @key ORDER BY pkid
            """, new { table, key = pkid.ToString() })).ToList();
    }

    // CourseGroup

    private CourseGroupRepository CourseGroups => new(_db, _audit);

    private async Task<short> NewCourseGroupAsync(string description)
    {
        var pkid = await CourseGroups.CreateAsync(new CourseGroupRequest { Description = description });
        _courseGroups.Add(pkid);
        return pkid;
    }

    [Fact]
    public async Task Insert_WritesInsertRowWithFirstStringColumn()
    {
        var pkid = await NewCourseGroupAsync("稽核測試群組");

        var row = Assert.Single(await AuditRowsAsync("CourseGroup", pkid));
        Assert.Equal("CourseGroup", row.TableName);
        Assert.Equal("Insert", row.ActionType);
        Assert.Equal("稽核測試群組", row.ActionDesc);
        Assert.Equal(pkid.ToString(), row.PrimaryKeyValues);
        Assert.Equal(Tester, row.UserName);
        Assert.Equal(Now.UtcDateTime, row.DateTime);
    }

    [Fact]
    public async Task Update_WritesUpdateRowListingChangedColumns()
    {
        var pkid = await NewCourseGroupAsync("改名前");

        Assert.True(await CourseGroups.UpdateAsync(new CourseGroupRequest { Pkid = pkid, Description = "改名後" }));

        var rows = await AuditRowsAsync("CourseGroup", pkid);
        Assert.Equal(["Insert", "Update"], rows.Select(r => r.ActionType));
        Assert.Equal("Description", rows[1].ActionDesc);
    }

    [Fact]
    public async Task Update_NothingChanged_WritesNoRow()
    {
        var pkid = await NewCourseGroupAsync("不變");

        Assert.True(await CourseGroups.UpdateAsync(new CourseGroupRequest { Pkid = pkid, Description = "不變" }));

        Assert.Equal(["Insert"], (await AuditRowsAsync("CourseGroup", pkid)).Select(r => r.ActionType));
    }

    [Fact]
    public async Task Delete_WritesDeleteRowWithFirstStringColumn()
    {
        var pkid = await NewCourseGroupAsync("待刪除群組");

        Assert.True(await CourseGroups.DeleteAsync(pkid));

        var rows = await AuditRowsAsync("CourseGroup", pkid);
        Assert.Equal(["Insert", "Delete"], rows.Select(r => r.ActionType));
        Assert.Equal("待刪除群組", rows[1].ActionDesc);
        Assert.Null(await CourseGroups.GetByIdAsync(pkid));
    }

    [Fact]
    public async Task FailedUpdate_WritesNoRow()
    {
        var pkid = await NewCourseGroupAsync("原名");

        // Description is nvarchar(100): the UPDATE fails with a truncation error
        await Assert.ThrowsAsync<SqlException>(() =>
            CourseGroups.UpdateAsync(new CourseGroupRequest { Pkid = pkid, Description = new string('長', 101) }));

        Assert.Equal(["Insert"], (await AuditRowsAsync("CourseGroup", pkid)).Select(r => r.ActionType));
        Assert.Equal("原名", (await CourseGroups.GetByIdAsync(pkid))!.Description);
    }

    // Course: n-n relations, and a failure after the UPDATE statement already ran

    private CourseRepository Courses => new(_db, _audit);

    private async Task<CourseRequest> NewCourseRequestAsync()
    {
        using var conn = await _db.CreateOpenConnectionAsync();
        var marker = Guid.NewGuid().ToString("N")[..12];
        return new CourseRequest
        {
            Title = "稽核測試課程",
            CourseId = $"AUDIT-{marker}",
            ProdCourseId = $"AUDIT-{marker}",
            FriendlyUrl = $"audit-{marker}",
            PartnerPkid = await conn.ExecuteScalarAsync<short>("SELECT TOP 1 pkid FROM Partner ORDER BY pkid"),
            PublishStatusPkid = await conn.ExecuteScalarAsync<byte>("SELECT TOP 1 pkid FROM PublishStatus ORDER BY pkid"),
            ScheduleOn = new DateOnly(2026, 1, 1),
            ScheduleOff = new DateOnly(2026, 12, 31),
            Hour = 6,
        };
    }

    private async Task<short> AnyJobCategoryAsync()
    {
        using var conn = await _db.CreateOpenConnectionAsync();
        return await conn.ExecuteScalarAsync<short>("SELECT TOP 1 pkid FROM JobCategory ORDER BY pkid");
    }

    [Fact]
    public async Task Course_UpdateListsScalarAndNnChanges()
    {
        var request = await NewCourseRequestAsync();
        var pkid = await Courses.CreateAsync(request);
        _courses.Add(pkid);

        request.Pkid = pkid;
        request.Hour = 12;
        request.JobCategoryPkids = [await AnyJobCategoryAsync()];
        Assert.True(await Courses.UpdateAsync(request));

        var rows = await AuditRowsAsync("Course", pkid);
        Assert.Equal(["Insert", "Update"], rows.Select(r => r.ActionType));
        Assert.Equal("稽核測試課程", rows[0].ActionDesc);
        Assert.Equal("Hour,JobCategories", rows[1].ActionDesc);
    }

    [Fact]
    public async Task Course_FailedUpdate_RollsBackChangeAndWritesNoRow()
    {
        var request = await NewCourseRequestAsync();
        var pkid = await Courses.CreateAsync(request);
        _courses.Add(pkid);

        // The UPDATE succeeds inside the transaction; the n-n insert then hits the FK and everything rolls back.
        request.Pkid = pkid;
        request.Title = "不該被儲存";
        request.CertificationPkids = [int.MaxValue];
        await Assert.ThrowsAsync<InvalidReferenceException>(() => Courses.UpdateAsync(request));

        Assert.Equal(["Insert"], (await AuditRowsAsync("Course", pkid)).Select(r => r.ActionType));
        Assert.Equal("稽核測試課程", (await Courses.GetByIdAsync(pkid))!.Title);
    }

    [Fact]
    public async Task Course_Delete_WritesDeleteRow()
    {
        var pkid = await Courses.CreateAsync(await NewCourseRequestAsync());
        _courses.Add(pkid);

        Assert.True(await Courses.DeleteAsync(pkid));

        var rows = await AuditRowsAsync("Course", pkid);
        Assert.Equal(["Insert", "Delete"], rows.Select(r => r.ActionType));
        Assert.Equal("稽核測試課程", rows[1].ActionDesc);
    }
}

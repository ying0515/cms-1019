using System.Data;
using System.Security.Claims;
using CMS.API.Data;
using CMS.API.Models;
using CMS.API.Tests.Infrastructure;
using Microsoft.AspNetCore.Http;

namespace CMS.API.Tests;

public class RowAuditWriterTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 20, 3, 4, 5, TimeSpan.Zero);

    private class Widget
    {
        public int Pkid { get; set; }
        public int DisplayOrder { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Note { get; set; }
        public decimal? Price { get; set; }
        public DateOnly StartOn { get; set; }
        public PartnerLookup? Partner { get; set; }
        public List<CertificationLookup> Certifications { get; set; } = [];
    }

    private class NoKey
    {
        public string Name { get; set; } = string.Empty;
    }

    /// <summary>The Build* methods never touch the database.</summary>
    private class NoDb : IDbConnectionFactory
    {
        public Task<IDbConnection> CreateOpenConnectionAsync() => throw new InvalidOperationException("no DB in unit tests");
    }

    private static RowAuditWriter Writer(ClaimsPrincipal? user = null)
    {
        var http = new HttpContextAccessor();
        if (user is not null) http.HttpContext = new DefaultHttpContext { User = user };
        return new RowAuditWriter(new NoDb(), http, new FixedTimeProvider(Now));
    }

    private static ClaimsPrincipal SignedIn(string claimType, string userName)
        => new(new ClaimsIdentity([new Claim(claimType, userName)], authenticationType: "Bearer"));

    private static Widget Sample() => new()
    {
        Pkid = 42, DisplayOrder = 1, Name = "Angular 入門", Note = "n", Price = 10m, StartOn = new DateOnly(2026, 1, 1),
    };

    [Fact]
    public void BuildInsert_UsesFirstStringPropertyAsActionDesc()
    {
        var audit = Writer().BuildInsert("Widget", Sample());

        Assert.Equal("Widget", audit.TableName);
        Assert.Equal("Insert", audit.ActionType);
        Assert.Equal("Angular 入門", audit.ActionDesc);
        Assert.Equal(Now.UtcDateTime, audit.DateTime);
    }

    [Fact]
    public void BuildDelete_UsesFirstStringPropertyAsActionDesc()
    {
        var audit = Writer().BuildDelete("Widget", Sample());

        Assert.Equal("Delete", audit.ActionType);
        Assert.Equal("Angular 入門", audit.ActionDesc);
    }

    [Fact]
    public void BuildInsert_ReadsFirstStringPropertyOfRealModel()
    {
        var course = new Course { Pkid = 7, Title = "課程名稱", CourseId = "C001" };

        var audit = Writer().BuildInsert("Course", course);

        Assert.Equal("課程名稱", audit.ActionDesc);
        Assert.Equal("7", audit.PrimaryKeyValues);
    }

    [Fact]
    public void PrimaryKeyValues_IsPkidAsString()
    {
        Assert.Equal("42", Writer().BuildInsert("Widget", Sample()).PrimaryKeyValues);
    }

    [Fact]
    public void Build_WithoutPkidProperty_Throws()
    {
        Assert.Throws<InvalidOperationException>(() => Writer().BuildInsert("NoKey", new NoKey()));
    }

    [Fact]
    public void BuildUpdate_ListsExactlyTheChangedPropertyNames()
    {
        var before = Sample();
        var after = Sample();
        after.Name = "Angular 進階";
        after.Note = null;
        after.Price = 12m;
        // nav objects are not compared
        after.Partner = new PartnerLookup();

        var audit = Writer().BuildUpdate("Widget", before, after);

        Assert.Equal("Update", audit.ActionType);
        Assert.Equal("Name,Note,Price", audit.ActionDesc);
        Assert.Equal("42", audit.PrimaryKeyValues);
    }

    [Fact]
    public void BuildUpdate_ListsNnCollectionWhenItsItemsChange()
    {
        var before = Sample();
        before.Certifications = [new CertificationLookup { Pkid = 1 }, new CertificationLookup { Pkid = 2 }];
        var after = Sample();
        after.Certifications = [new CertificationLookup { Pkid = 1 }, new CertificationLookup { Pkid = 3 }];

        Assert.Equal("Certifications", Writer().BuildUpdate("Widget", before, after).ActionDesc);
    }

    [Fact]
    public void BuildUpdate_SameNnItemsInAnotherOrder_IsNotAChange()
    {
        var before = Sample();
        before.Certifications = [new CertificationLookup { Pkid = 1 }, new CertificationLookup { Pkid = 2 }];
        var after = Sample();
        after.Certifications = [new CertificationLookup { Pkid = 2 }, new CertificationLookup { Pkid = 1 }];

        Assert.Equal(string.Empty, Writer().BuildUpdate("Widget", before, after).ActionDesc);
    }

    [Fact]
    public void BuildUpdate_SkipsRowAuditIgnoreProperties()
    {
        var before = new AppUser { Pkid = 1, UserId = "helen", RoleCount = 1, Roles = [new AppRoleLookup { RoleId = "Admin" }] };
        var after = new AppUser { Pkid = 1, UserId = "helen", RoleCount = 0, Roles = [] };

        Assert.Equal("Roles", Writer().BuildUpdate("AppUser", before, after).ActionDesc);
    }

    [Fact]
    public void BuildUpdate_NothingChanged_IsEmpty()
    {
        Assert.Equal(string.Empty, Writer().BuildUpdate("Widget", Sample(), Sample()).ActionDesc);
    }

    [Fact]
    public async Task LogUpdate_NothingChanged_WritesNoRow()
    {
        // NoDb throws if a connection is opened
        await Writer().LogUpdateAsync("Widget", Sample(), Sample());
    }

    [Fact]
    public void UserName_NoHttpContext_IsSystem()
    {
        Assert.Equal("system", Writer().BuildInsert("Widget", Sample()).UserName);
    }

    [Fact]
    public void UserName_Unauthenticated_IsSystem()
    {
        var anonymous = new ClaimsPrincipal(new ClaimsIdentity([new Claim("name", "helen")]));

        Assert.Equal("system", Writer(anonymous).BuildInsert("Widget", Sample()).UserName);
    }

    [Theory]
    [InlineData("name")]
    [InlineData(ClaimTypes.Name)]
    public void UserName_ComesFromJwtNameClaim(string claimType)
    {
        var audit = Writer(SignedIn(claimType, "海倫")).BuildInsert("Widget", Sample());

        Assert.Equal("海倫", audit.UserName);
    }

    [Fact]
    public void ActionDesc_TruncatesAt1000()
    {
        var entity = Sample();
        entity.Name = new string('x', 1001);

        var audit = Writer().BuildInsert("Widget", entity);

        Assert.Equal(new string('x', 1000), audit.ActionDesc);
    }

    [Fact]
    public void ActionDesc_Exactly1000_IsKept()
    {
        var entity = Sample();
        entity.Name = new string('x', 1000);

        Assert.Equal(1000, Writer().BuildInsert("Widget", entity).ActionDesc!.Length);
    }
}

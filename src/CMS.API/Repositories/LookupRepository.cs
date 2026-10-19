using CMS.API.Data;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Repositories;

public class LookupRepository(IDbConnectionFactory db) : ILookupRepository
{
    public async Task<IEnumerable<AppUserLookup>> GetAppUsersAsync()
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.QueryAsync<AppUserLookup>(
            "SELECT UserId, UserName, IsActive FROM AppUser ORDER BY UserName ASC");
    }

    public async Task<IEnumerable<PublishStatusLookup>> GetPublishStatusesAsync()
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.QueryAsync<PublishStatusLookup>(
            "SELECT pkid, Description FROM PublishStatus ORDER BY pkid ASC");
    }

    public async Task<IEnumerable<PartnerLookup>> GetPartnersAsync()
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.QueryAsync<PartnerLookup>(
            "SELECT pkid, Name FROM Partner ORDER BY DisplayOrder ASC, pkid ASC");
    }

    public async Task<IEnumerable<CourseGroupLookup>> GetCourseGroupsAsync()
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.QueryAsync<CourseGroupLookup>(
            "SELECT pkid, Description FROM CourseGroup ORDER BY pkid ASC");
    }
}

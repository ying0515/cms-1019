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

    public async Task<IEnumerable<AppRoleLookup>> GetAppRolesAsync()
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.QueryAsync<AppRoleLookup>(
            "SELECT RoleId, RoleName FROM AppRole ORDER BY RoleId ASC");
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

    public async Task<IEnumerable<CertificationLookup>> GetCertificationsAsync()
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.QueryAsync<CertificationLookup>("""
            SELECT c.pkid, RTRIM(c.Title) AS Title, c.Partner_pkid AS PartnerPkid, p.Name AS PartnerName
            FROM Certification c
            INNER JOIN Partner p ON p.pkid = c.Partner_pkid
            ORDER BY p.DisplayOrder ASC, p.pkid ASC, c.Title ASC
            """);
    }

    public async Task<IEnumerable<JobCategoryLookup>> GetJobCategoriesAsync()
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.QueryAsync<JobCategoryLookup>(
            "SELECT pkid, Description FROM JobCategory ORDER BY pkid ASC");
    }

    public async Task<IEnumerable<TrainingCenterLookup>> GetTrainingCentersAsync()
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await conn.QueryAsync<TrainingCenterLookup>(
            "SELECT pkid, Name FROM TrainingCenter ORDER BY DisplayOrder ASC, pkid ASC");
    }

    public async Task<IEnumerable<PromotionLookup>> GetPromotionsAsync(string? keyword, int take)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        var k = string.IsNullOrEmpty(keyword) ? null : EscapeLike(keyword);
        return await conn.QueryAsync<PromotionLookup>("""
            SELECT TOP (@take) pkid, PromoCode, Topic, Description
            FROM Promotion2
            WHERE @k IS NULL OR PromoCode LIKE '%' + @k + '%' ESCAPE '\'
            ORDER BY CASE WHEN PromoCode LIKE @k + '%' ESCAPE '\' THEN 0 ELSE 1 END, pkid DESC
            """, new { k, take });
    }

    // PromoCodes often contain "_", which is a LIKE wildcard
    private static string EscapeLike(string s)
        => s.Replace(@"\", @"\\").Replace("%", @"\%").Replace("_", @"\_").Replace("[", @"\[");
}

using System.Data;
using CMS.API.Data;
using CMS.API.Models;
using Dapper;
using Microsoft.Data.SqlClient;

namespace CMS.API.Repositories;

public class CourseRepository(IDbConnectionFactory db) : ICourseRepository
{
    private const string SelectSql = """
        SELECT c.pkid, c.Title, c.OfficialTitle, c.CourseId, c.ProdCourseId, c.FriendlyUrl, c.DisplayOrder,
               c.Partner_pkid AS PartnerPkid, c.CourseGroup_pkid AS CourseGroupPkid,
               c.PublishStatus_pkid AS PublishStatusPkid, c.ScheduleOn, c.ScheduleOff, c.Hour,
               c.ListPrice, c.LearningCredit, c.Material, c.Objective, c.Target, c.Prerequisites,
               c.Outline, c.TowardCertOrExam, c.Note, c.OtherInfo, c.CanRepeat,
               p.pkid, p.Name,
               cg.pkid, cg.Description,
               ps.pkid, ps.Description, ps.IsPublished
        FROM Course c
        INNER JOIN Partner p ON p.pkid = c.Partner_pkid
        LEFT JOIN CourseGroup cg ON cg.pkid = c.CourseGroup_pkid
        INNER JOIN PublishStatus ps ON ps.pkid = c.PublishStatus_pkid
        """;

    private const string OrderBySql = " ORDER BY c.DisplayOrder ASC, c.pkid DESC";

    // Partner / CourseGroup / PublishStatus segments each start at their pkid column
    private const string SplitOn = "pkid,pkid,pkid";

    private const int ForeignKeyViolation = 547;

    public async Task<IEnumerable<Course>> GetAllAsync()
    {
        using var conn = await db.CreateOpenConnectionAsync();
        return await QueryCoursesAsync(conn, SelectSql + OrderBySql);
    }

    public async Task<IEnumerable<Course>> QueryAsync(CourseQuery query)
    {
        var where = new List<string>();
        var p = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            where.Add("""
                (c.Title LIKE @Keyword OR c.OfficialTitle LIKE @Keyword OR c.CourseId LIKE @Keyword
                 OR c.ProdCourseId LIKE @Keyword OR c.FriendlyUrl LIKE @Keyword)
                """);
            p.Add("Keyword", $"%{query.Keyword.Trim()}%");
        }
        if (query.PartnerPkid.HasValue)
        {
            where.Add("c.Partner_pkid = @PartnerPkid");
            p.Add("PartnerPkid", query.PartnerPkid);
        }
        if (query.CourseGroupPkid.HasValue)
        {
            where.Add("c.CourseGroup_pkid = @CourseGroupPkid");
            p.Add("CourseGroupPkid", query.CourseGroupPkid);
        }
        if (query.PublishStatusPkid.HasValue)
        {
            where.Add("c.PublishStatus_pkid = @PublishStatusPkid");
            p.Add("PublishStatusPkid", query.PublishStatusPkid);
        }
        if (query.ScheduleOnFrom.HasValue)
        {
            where.Add("c.ScheduleOn >= @ScheduleOnFrom");
            p.Add("ScheduleOnFrom", query.ScheduleOnFrom.Value);
        }
        if (query.ScheduleOnTo.HasValue)
        {
            where.Add("c.ScheduleOn <= @ScheduleOnTo");
            p.Add("ScheduleOnTo", query.ScheduleOnTo.Value);
        }
        if (query.ScheduleOffFrom.HasValue)
        {
            where.Add("c.ScheduleOff >= @ScheduleOffFrom");
            p.Add("ScheduleOffFrom", query.ScheduleOffFrom.Value);
        }
        if (query.ScheduleOffTo.HasValue)
        {
            where.Add("c.ScheduleOff <= @ScheduleOffTo");
            p.Add("ScheduleOffTo", query.ScheduleOffTo.Value);
        }
        if (query.CanRepeat.HasValue)
        {
            where.Add("c.CanRepeat = @CanRepeat");
            p.Add("CanRepeat", query.CanRepeat);
        }

        var sql = SelectSql
            + (where.Count > 0 ? " WHERE " + string.Join(" AND ", where) : "")
            + OrderBySql;

        using var conn = await db.CreateOpenConnectionAsync();
        return await QueryCoursesAsync(conn, sql, p);
    }

    public async Task<Course?> GetByIdAsync(int pkid)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        var course = (await QueryCoursesAsync(conn, SelectSql + " WHERE c.pkid = @pkid", new { pkid }))
            .SingleOrDefault();
        if (course is null) return null;

        // n-n: separate queries on same connection
        course.Certifications = (await conn.QueryAsync<CertificationLookup>("""
            SELECT c.pkid, RTRIM(c.Title) AS Title, c.Partner_pkid AS PartnerPkid, p.Name AS PartnerName
            FROM CourseInCertification ci
            INNER JOIN Certification c ON c.pkid = ci.Certification_pkid
            INNER JOIN Partner p ON p.pkid = c.Partner_pkid
            WHERE ci.Course_pkid = @pkid
            ORDER BY p.DisplayOrder ASC, p.pkid ASC, c.Title ASC
            """, new { pkid })).ToList();

        course.JobCategories = (await conn.QueryAsync<JobCategoryLookup>("""
            SELECT j.pkid, j.Description
            FROM CourseJobCategories cj
            INNER JOIN JobCategory j ON j.pkid = cj.JobCategory_pkid
            WHERE cj.Course_pkid = @pkid
            ORDER BY j.pkid ASC
            """, new { pkid })).ToList();

        return course;
    }

    public async Task<int> CreateAsync(CourseRequest request)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        using var tx = conn.BeginTransaction();
        try
        {
            var pkid = await conn.ExecuteScalarAsync<int>("""
                INSERT INTO Course (Title, OfficialTitle, CourseId, ProdCourseId, FriendlyUrl, DisplayOrder,
                    Partner_pkid, CourseGroup_pkid, PublishStatus_pkid, ScheduleOn, ScheduleOff, Hour,
                    ListPrice, LearningCredit, Material, Objective, Target, Prerequisites, Outline,
                    TowardCertOrExam, Note, OtherInfo, CanRepeat)
                VALUES (@Title, @OfficialTitle, @CourseId, @ProdCourseId, @FriendlyUrl, @DisplayOrder,
                    @PartnerPkid, @CourseGroupPkid, @PublishStatusPkid, @ScheduleOn, @ScheduleOff, @Hour,
                    @ListPrice, @LearningCredit, @Material, @Objective, @Target, @Prerequisites, @Outline,
                    @TowardCertOrExam, @Note, @OtherInfo, @CanRepeat);
                SELECT CAST(SCOPE_IDENTITY() AS int);
                """, ToParams(request), tx);

            await SyncRelationsAsync(conn, tx, pkid, request);
            tx.Commit();
            return pkid;
        }
        catch (SqlException ex) when (ex.Number == ForeignKeyViolation)
        {
            throw InvalidReference();
        }
    }

    public async Task<bool> UpdateAsync(CourseRequest request)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        using var tx = conn.BeginTransaction();
        try
        {
            var updated = await conn.ExecuteAsync("""
                UPDATE Course
                SET Title = @Title, OfficialTitle = @OfficialTitle, CourseId = @CourseId,
                    ProdCourseId = @ProdCourseId, FriendlyUrl = @FriendlyUrl, DisplayOrder = @DisplayOrder,
                    Partner_pkid = @PartnerPkid, CourseGroup_pkid = @CourseGroupPkid,
                    PublishStatus_pkid = @PublishStatusPkid, ScheduleOn = @ScheduleOn,
                    ScheduleOff = @ScheduleOff, Hour = @Hour, ListPrice = @ListPrice,
                    LearningCredit = @LearningCredit, Material = @Material, Objective = @Objective,
                    Target = @Target, Prerequisites = @Prerequisites, Outline = @Outline,
                    TowardCertOrExam = @TowardCertOrExam, Note = @Note, OtherInfo = @OtherInfo,
                    CanRepeat = @CanRepeat
                WHERE pkid = @Pkid
                """, ToParams(request), tx);
            if (updated == 0) return false;

            await SyncRelationsAsync(conn, tx, request.Pkid, request);
            tx.Commit();
            return true;
        }
        catch (SqlException ex) when (ex.Number == ForeignKeyViolation)
        {
            throw InvalidReference();
        }
    }

    public async Task<bool> DeleteAsync(int pkid)
    {
        using var conn = await db.CreateOpenConnectionAsync();
        try
        {
            // CourseInCertification / CourseJobCategories rows cascade
            return await conn.ExecuteAsync("DELETE FROM Course WHERE pkid = @pkid", new { pkid }) > 0;
        }
        catch (SqlException ex) when (ex.Number == ForeignKeyViolation)
        {
            // Referenced by CourseFAQ / CourseRelatedLink / HotCourse
            var courseId = await conn.ExecuteScalarAsync<string?>(
                "SELECT CourseId FROM Course WHERE pkid = @pkid", new { pkid });
            throw new ReferenceConflictException($"課程「{courseId}」已被使用，無法刪除");
        }
    }

    private static Task<IEnumerable<Course>> QueryCoursesAsync(IDbConnection conn, string sql, object? param = null)
        => conn.QueryAsync<Course, PartnerLookup, CourseGroupLookup, PublishStatusLookup, Course>(
            sql,
            (course, partner, courseGroup, publishStatus) =>
            {
                course.Partner = partner;
                course.CourseGroup = courseGroup; // null when the LEFT JOIN misses
                course.PublishStatus = publishStatus;
                return course;
            },
            param,
            splitOn: SplitOn);

    // Unwrap DateOnly? so the registered DateOnly type handler binds the parameters
    private static object ToParams(CourseRequest r) => new
    {
        r.Pkid, r.Title, r.OfficialTitle, r.CourseId, r.ProdCourseId, r.FriendlyUrl, r.DisplayOrder,
        r.PartnerPkid, r.CourseGroupPkid, r.PublishStatusPkid,
        ScheduleOn = r.ScheduleOn!.Value,
        ScheduleOff = r.ScheduleOff!.Value,
        r.Hour, r.ListPrice, r.LearningCredit, r.Material, r.Objective, r.Target, r.Prerequisites,
        r.Outline, r.TowardCertOrExam, r.Note, r.OtherInfo, r.CanRepeat,
    };

    // n-n: delete-then-reinsert
    private static async Task SyncRelationsAsync(IDbConnection conn, IDbTransaction tx, int pkid, CourseRequest request)
    {
        await conn.ExecuteAsync("DELETE FROM CourseInCertification WHERE Course_pkid = @pkid", new { pkid }, tx);
        var certs = request.CertificationPkids.Distinct()
            .Select(id => new { CoursePkid = pkid, CertificationPkid = id }).ToList();
        if (certs.Count > 0)
            await conn.ExecuteAsync("""
                INSERT INTO CourseInCertification (Course_pkid, Certification_pkid)
                VALUES (@CoursePkid, @CertificationPkid)
                """, certs, tx);

        await conn.ExecuteAsync("DELETE FROM CourseJobCategories WHERE Course_pkid = @pkid", new { pkid }, tx);
        var jobs = request.JobCategoryPkids.Distinct()
            .Select(id => new { CoursePkid = pkid, JobCategoryPkid = id }).ToList();
        if (jobs.Count > 0)
            await conn.ExecuteAsync("""
                INSERT INTO CourseJobCategories (Course_pkid, JobCategory_pkid)
                VALUES (@CoursePkid, @JobCategoryPkid)
                """, jobs, tx);
    }

    private static InvalidReferenceException InvalidReference()
        => new("原廠、課程群組、上架狀態、認證或職務類別不存在");
}

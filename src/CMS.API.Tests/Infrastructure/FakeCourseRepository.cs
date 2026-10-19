using CMS.API.Models;
using CMS.API.Repositories;

namespace CMS.API.Tests.Infrastructure;

/// <summary>
/// In-memory ICourseRepository so endpoint tests run without SQL Server.
/// FK nav objects are resolved from the Partner / CourseGroup / PublishStatus fakes, like the SQL JOINs.
/// </summary>
public class FakeCourseRepository(FakePartnerRepository partners, FakeCourseGroupRepository courseGroups,
    FakePublishStatusRepository publishStatuses) : ICourseRepository
{
    private readonly object _lock = new();
    private int _nextPkid = 4;

    /// <summary>Seeded Certification rows (Title is already RTRIM'd).</summary>
    public List<(int Pkid, short PartnerPkid, string? Title)> Certifications { get; } =
    [
        (1, 1, "Azure Administrator Associate"),
        (2, 1, "Azure Developer Associate"),
        (3, 2, "CCNA"),
    ];

    public List<JobCategoryLookup> JobCategories { get; } =
    [
        new() { Pkid = 1, Description = "系統管理" },
        new() { Pkid = 2, Description = "軟體開發" },
        new() { Pkid = 3, Description = "網路工程" },
    ];

    private readonly List<CourseRequest> _items =
    [
        new()
        {
            Pkid = 1, Title = "Microsoft Azure 管理員", OfficialTitle = "Microsoft Azure Administrator",
            CourseId = "AZ-104", ProdCourseId = "AZ-104T00", FriendlyUrl = "az-104", DisplayOrder = 1,
            PartnerPkid = 1, CourseGroupPkid = 1, PublishStatusPkid = 2,
            ScheduleOn = new DateOnly(2026, 1, 1), ScheduleOff = new DateOnly(2036, 1, 1),
            Hour = 32, ListPrice = 28000, LearningCredit = 4.0m, Objective = "管理 Azure 訂用帳戶",
            CanRepeat = true, CertificationPkids = [1], JobCategoryPkids = [1],
        },
        new()
        {
            Pkid = 2, Title = "Cisco CCNA 網路認證", CourseId = "CCNA", ProdCourseId = "200-301",
            FriendlyUrl = "ccna", DisplayOrder = 2, PartnerPkid = 2, CourseGroupPkid = 3, PublishStatusPkid = 2,
            ScheduleOn = new DateOnly(2026, 3, 1), ScheduleOff = new DateOnly(2027, 3, 1),
            Hour = 40, ListPrice = 35000, LearningCredit = 5.5m, CanRepeat = false,
            CertificationPkids = [3], JobCategoryPkids = [3],
        },
        new()
        {
            Pkid = 3, Title = "AWS 解決方案架構師", CourseId = "AWS-SAA", ProdCourseId = "AWS-SAA-C03",
            FriendlyUrl = "aws-saa", DisplayOrder = 1, PartnerPkid = 3, CourseGroupPkid = null, PublishStatusPkid = 1,
            ScheduleOn = new DateOnly(2026, 6, 15), ScheduleOff = new DateOnly(2036, 6, 15),
            Hour = 24, ListPrice = 21000, LearningCredit = 3.0m, CanRepeat = true,
            CertificationPkids = [], JobCategoryPkids = [1, 2],
        },
    ];

    /// <summary>Pkids treated as referenced by CourseFAQ / CourseRelatedLink / HotCourse (delete → conflict).</summary>
    public HashSet<int> InUse { get; } = [1];

    public IEnumerable<CertificationLookup> CertificationLookups()
    {
        var partnerList = partners.Items;
        return Certifications.Select(c => new CertificationLookup
        {
            Pkid = c.Pkid,
            Title = c.Title,
            PartnerPkid = c.PartnerPkid,
            PartnerName = partnerList.FirstOrDefault(p => p.Pkid == c.PartnerPkid)?.Name ?? string.Empty,
        });
    }

    public Task<IEnumerable<Course>> GetAllAsync()
    {
        lock (_lock)
            return Task.FromResult<IEnumerable<Course>>(Sort(_items).Select(ToCourse).ToList());
    }

    public Task<IEnumerable<Course>> QueryAsync(CourseQuery query)
    {
        lock (_lock)
        {
            IEnumerable<CourseRequest> q = _items;
            if (!string.IsNullOrWhiteSpace(query.Keyword))
            {
                var k = query.Keyword.Trim();
                q = q.Where(c => new[] { c.Title, c.OfficialTitle, c.CourseId, c.ProdCourseId, c.FriendlyUrl }
                    .Any(s => s?.Contains(k, StringComparison.OrdinalIgnoreCase) == true));
            }
            if (query.PartnerPkid.HasValue) q = q.Where(c => c.PartnerPkid == query.PartnerPkid);
            if (query.CourseGroupPkid.HasValue) q = q.Where(c => c.CourseGroupPkid == query.CourseGroupPkid);
            if (query.PublishStatusPkid.HasValue) q = q.Where(c => c.PublishStatusPkid == query.PublishStatusPkid);
            if (query.ScheduleOnFrom.HasValue) q = q.Where(c => c.ScheduleOn >= query.ScheduleOnFrom);
            if (query.ScheduleOnTo.HasValue) q = q.Where(c => c.ScheduleOn <= query.ScheduleOnTo);
            if (query.ScheduleOffFrom.HasValue) q = q.Where(c => c.ScheduleOff >= query.ScheduleOffFrom);
            if (query.ScheduleOffTo.HasValue) q = q.Where(c => c.ScheduleOff <= query.ScheduleOffTo);
            if (query.CanRepeat.HasValue) q = q.Where(c => c.CanRepeat == query.CanRepeat);
            return Task.FromResult<IEnumerable<Course>>(Sort(q).Select(ToCourse).ToList());
        }
    }

    public Task<Course?> GetByIdAsync(int pkid)
    {
        lock (_lock)
        {
            var row = _items.FirstOrDefault(x => x.Pkid == pkid);
            if (row is null) return Task.FromResult<Course?>(null);

            var course = ToCourse(row);
            var certs = CertificationLookups().ToList();
            course.Certifications = row.CertificationPkids.Distinct()
                .Select(id => certs.First(c => c.Pkid == id)).ToList();
            course.JobCategories = row.JobCategoryPkids.Distinct().OrderBy(id => id)
                .Select(id => JobCategories.First(j => j.Pkid == id)).ToList();
            return Task.FromResult<Course?>(course);
        }
    }

    public Task<int> CreateAsync(CourseRequest request)
    {
        lock (_lock)
        {
            EnsureReferencesExist(request);
            var pkid = _nextPkid++;
            _items.Add(Copy(request, pkid));
            return Task.FromResult(pkid);
        }
    }

    public Task<bool> UpdateAsync(CourseRequest request)
    {
        lock (_lock)
        {
            var index = _items.FindIndex(x => x.Pkid == request.Pkid);
            if (index < 0) return Task.FromResult(false);
            EnsureReferencesExist(request);
            _items[index] = Copy(request, request.Pkid);
            return Task.FromResult(true);
        }
    }

    public Task<bool> DeleteAsync(int pkid)
    {
        lock (_lock)
        {
            var existing = _items.FirstOrDefault(x => x.Pkid == pkid);
            if (existing is null) return Task.FromResult(false);
            if (InUse.Contains(pkid))
                throw new ReferenceConflictException($"課程「{existing.CourseId}」已被使用，無法刪除");
            _items.Remove(existing);
            return Task.FromResult(true);
        }
    }

    // Mirrors the FOREIGN KEY constraints (SQL 547 → InvalidReferenceException)
    private void EnsureReferencesExist(CourseRequest r)
    {
        var ok = partners.Items.Any(p => p.Pkid == r.PartnerPkid)
            && publishStatuses.Items.Any(s => s.Pkid == r.PublishStatusPkid)
            && (r.CourseGroupPkid is null || courseGroups.Items.Any(g => g.Pkid == r.CourseGroupPkid))
            && r.CertificationPkids.All(id => Certifications.Any(c => c.Pkid == id))
            && r.JobCategoryPkids.All(id => JobCategories.Any(j => j.Pkid == id));
        if (!ok) throw new InvalidReferenceException("原廠、課程群組、上架狀態、認證或職務類別不存在");
    }

    // Mirrors ORDER BY DisplayOrder ASC, pkid DESC
    private static IEnumerable<CourseRequest> Sort(IEnumerable<CourseRequest> items)
        => items.OrderBy(c => c.DisplayOrder).ThenByDescending(c => c.Pkid);

    private Course ToCourse(CourseRequest r)
    {
        var partner = partners.Items.FirstOrDefault(p => p.Pkid == r.PartnerPkid);
        var group = courseGroups.Items.FirstOrDefault(g => g.Pkid == r.CourseGroupPkid);
        var status = publishStatuses.Items.FirstOrDefault(s => s.Pkid == r.PublishStatusPkid);
        return new Course
        {
            Pkid = r.Pkid,
            Title = r.Title,
            OfficialTitle = r.OfficialTitle,
            CourseId = r.CourseId,
            ProdCourseId = r.ProdCourseId,
            FriendlyUrl = r.FriendlyUrl,
            DisplayOrder = r.DisplayOrder,
            PartnerPkid = r.PartnerPkid,
            CourseGroupPkid = r.CourseGroupPkid,
            PublishStatusPkid = r.PublishStatusPkid,
            ScheduleOn = r.ScheduleOn!.Value,
            ScheduleOff = r.ScheduleOff!.Value,
            Hour = r.Hour,
            ListPrice = r.ListPrice,
            LearningCredit = r.LearningCredit,
            Material = r.Material,
            Objective = r.Objective,
            Target = r.Target,
            Prerequisites = r.Prerequisites,
            Outline = r.Outline,
            TowardCertOrExam = r.TowardCertOrExam,
            Note = r.Note,
            OtherInfo = r.OtherInfo,
            CanRepeat = r.CanRepeat,
            Partner = partner is null ? null : new PartnerLookup { Pkid = partner.Pkid, Name = partner.Name },
            CourseGroup = group is null ? null : new CourseGroupLookup { Pkid = group.Pkid, Description = group.Description },
            PublishStatus = status is null ? null : new PublishStatusLookup { Pkid = status.Pkid, Description = status.Description },
        };
    }

    private static CourseRequest Copy(CourseRequest r, int pkid) => new()
    {
        Pkid = pkid,
        Title = r.Title,
        OfficialTitle = r.OfficialTitle,
        CourseId = r.CourseId,
        ProdCourseId = r.ProdCourseId,
        FriendlyUrl = r.FriendlyUrl,
        DisplayOrder = r.DisplayOrder,
        PartnerPkid = r.PartnerPkid,
        CourseGroupPkid = r.CourseGroupPkid,
        PublishStatusPkid = r.PublishStatusPkid,
        ScheduleOn = r.ScheduleOn,
        ScheduleOff = r.ScheduleOff,
        Hour = r.Hour,
        ListPrice = r.ListPrice,
        LearningCredit = r.LearningCredit,
        Material = r.Material,
        Objective = r.Objective,
        Target = r.Target,
        Prerequisites = r.Prerequisites,
        Outline = r.Outline,
        TowardCertOrExam = r.TowardCertOrExam,
        Note = r.Note,
        OtherInfo = r.OtherInfo,
        CanRepeat = r.CanRepeat,
        CertificationPkids = [.. r.CertificationPkids],
        JobCategoryPkids = [.. r.JobCategoryPkids],
    };
}

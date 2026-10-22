using CMS.API.Models;
using CMS.API.Repositories;

namespace CMS.API.Tests.Infrastructure;

/// <summary>In-memory ICourseGroupRepository so endpoint tests run without SQL Server.</summary>
public class FakeCourseGroupRepository : ICourseGroupRepository
{
    private readonly object _lock = new();
    private short _nextPkid = 4;
    private readonly List<CourseGroup> _items =
    [
        new() { Pkid = 1, Description = "雲端運算" },
        new() { Pkid = 2, Description = "資訊安全" },
        new() { Pkid = 3, Description = "網路" },
    ];

    /// <summary>Pkids treated as referenced by Course / PartnerCourseGroup (delete → conflict).</summary>
    public HashSet<short> InUse { get; } = [1];

    public IReadOnlyList<CourseGroup> Items
    {
        get { lock (_lock) return _items.Select(Clone).ToList(); }
    }

    public Task<IEnumerable<CourseGroup>> GetAllAsync()
    {
        lock (_lock)
            return Task.FromResult<IEnumerable<CourseGroup>>(
                _items.OrderByDescending(g => g.Pkid).Select(Clone).ToList());
    }

    public Task<IEnumerable<CourseGroup>> QueryAsync(CourseGroupQuery query)
    {
        lock (_lock)
        {
            IEnumerable<CourseGroup> q = _items;
            if (!string.IsNullOrWhiteSpace(query.Keyword))
                q = q.Where(g => g.Description.Contains(query.Keyword.Trim(), StringComparison.OrdinalIgnoreCase));
            return Task.FromResult<IEnumerable<CourseGroup>>(
                q.OrderByDescending(g => g.Pkid).Select(Clone).ToList());
        }
    }

    public Task<CourseGroup?> GetByIdAsync(short pkid)
    {
        lock (_lock)
        {
            var g = _items.FirstOrDefault(x => x.Pkid == pkid);
            return Task.FromResult(g is null ? null : Clone(g));
        }
    }

    public Task<short> CreateAsync(CourseGroupRequest request)
    {
        lock (_lock)
        {
            var pkid = _nextPkid++;
            _items.Add(new CourseGroup { Pkid = pkid, Description = request.Description });
            return Task.FromResult(pkid);
        }
    }

    public Task<bool> UpdateAsync(CourseGroupRequest request)
    {
        lock (_lock)
        {
            var existing = _items.FirstOrDefault(x => x.Pkid == request.Pkid);
            if (existing is null) return Task.FromResult(false);
            existing.Description = request.Description;
            return Task.FromResult(true);
        }
    }

    public Task<bool> DeleteAsync(short pkid)
    {
        lock (_lock)
        {
            var existing = _items.FirstOrDefault(x => x.Pkid == pkid);
            if (existing is null) return Task.FromResult(false);
            if (InUse.Contains(pkid))
                throw new ReferenceConflictException($"課程群組「{existing.Description}」已被使用，無法刪除");
            _items.Remove(existing);
            return Task.FromResult(true);
        }
    }

    private static CourseGroup Clone(CourseGroup g) => new() { Pkid = g.Pkid, Description = g.Description };
}

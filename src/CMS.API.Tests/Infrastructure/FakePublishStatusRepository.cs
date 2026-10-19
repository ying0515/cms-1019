using CMS.API.Models;
using CMS.API.Repositories;

namespace CMS.API.Tests.Infrastructure;

/// <summary>In-memory IPublishStatusRepository so endpoint tests run without SQL Server.</summary>
public class FakePublishStatusRepository : IPublishStatusRepository
{
    private readonly object _lock = new();
    private readonly List<PublishStatus> _items =
    [
        new() { Pkid = 1, Description = "草稿", IsDraft = true },
        new() { Pkid = 2, Description = "已發布", IsPublished = true },
        new() { Pkid = 3, Description = "已下架", IsDiscontinued = true },
    ];

    /// <summary>Pkids treated as referenced by Course / Promotion2 (delete → conflict).</summary>
    public HashSet<byte> InUse { get; } = [2];

    public IReadOnlyList<PublishStatus> Items
    {
        get { lock (_lock) return _items.Select(Clone).ToList(); }
    }

    public Task<IEnumerable<PublishStatus>> GetAllAsync()
    {
        lock (_lock)
            return Task.FromResult<IEnumerable<PublishStatus>>(_items.OrderBy(s => s.Pkid).Select(Clone).ToList());
    }

    public Task<IEnumerable<PublishStatus>> QueryAsync(PublishStatusQuery query)
    {
        lock (_lock)
        {
            IEnumerable<PublishStatus> q = _items;
            if (!string.IsNullOrWhiteSpace(query.Keyword))
                q = q.Where(s => s.Description.Contains(query.Keyword.Trim(), StringComparison.OrdinalIgnoreCase));
            if (query.IsDraft.HasValue) q = q.Where(s => s.IsDraft == query.IsDraft);
            if (query.IsPublished.HasValue) q = q.Where(s => s.IsPublished == query.IsPublished);
            if (query.IsDiscontinued.HasValue) q = q.Where(s => s.IsDiscontinued == query.IsDiscontinued);
            return Task.FromResult<IEnumerable<PublishStatus>>(q.OrderBy(s => s.Pkid).Select(Clone).ToList());
        }
    }

    public Task<PublishStatus?> GetByIdAsync(byte pkid)
    {
        lock (_lock)
        {
            var s = _items.FirstOrDefault(x => x.Pkid == pkid);
            return Task.FromResult(s is null ? null : Clone(s));
        }
    }

    public Task<bool> ExistsAsync(byte pkid)
    {
        lock (_lock)
            return Task.FromResult(_items.Any(x => x.Pkid == pkid));
    }

    public Task CreateAsync(PublishStatusRequest request)
    {
        lock (_lock)
        {
            _items.Add(new PublishStatus
            {
                Pkid = request.Pkid,
                Description = request.Description,
                IsDraft = request.IsDraft,
                IsPublished = request.IsPublished,
                IsDiscontinued = request.IsDiscontinued,
            });
            return Task.CompletedTask;
        }
    }

    public Task<bool> UpdateAsync(PublishStatusRequest request)
    {
        lock (_lock)
        {
            var existing = _items.FirstOrDefault(x => x.Pkid == request.Pkid);
            if (existing is null) return Task.FromResult(false);
            existing.Description = request.Description;
            existing.IsDraft = request.IsDraft;
            existing.IsPublished = request.IsPublished;
            existing.IsDiscontinued = request.IsDiscontinued;
            return Task.FromResult(true);
        }
    }

    public Task<bool> DeleteAsync(byte pkid)
    {
        lock (_lock)
        {
            var existing = _items.FirstOrDefault(x => x.Pkid == pkid);
            if (existing is null) return Task.FromResult(false);
            if (InUse.Contains(pkid))
                throw new ReferenceConflictException($"發布狀態「{existing.Description}」已被使用，無法刪除");
            _items.Remove(existing);
            return Task.FromResult(true);
        }
    }

    private static PublishStatus Clone(PublishStatus s) => new()
    {
        Pkid = s.Pkid,
        Description = s.Description,
        IsDraft = s.IsDraft,
        IsPublished = s.IsPublished,
        IsDiscontinued = s.IsDiscontinued,
    };
}

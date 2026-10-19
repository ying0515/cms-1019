using CMS.API.Models;
using CMS.API.Repositories;

namespace CMS.API.Tests.Infrastructure;

/// <summary>In-memory IPartnerRepository so endpoint tests run without SQL Server.</summary>
public class FakePartnerRepository : IPartnerRepository
{
    private readonly object _lock = new();
    private short _nextPkid = 4;
    private readonly List<Partner> _items =
    [
        new()
        {
            Pkid = 1, Name = "Microsoft", AppKey = "MS", NameOnPartnerMenu = "微軟 Microsoft",
            NameOnCourseDetailPage = "微軟", DisplayOrder = 1, ImageFilename = "ms.png",
        },
        new()
        {
            Pkid = 2, Name = "Cisco", AppKey = "CISCO", NameOnPartnerMenu = "思科 Cisco",
            NameOnCourseDetailPage = "思科", DisplayOrder = 2,
        },
        new()
        {
            Pkid = 3, Name = "AWS", AppKey = "AWS", NameOnPartnerMenu = "Amazon Web Services",
            NameOnCourseDetailPage = "AWS", DisplayOrder = 1, ImageFilename = "aws.svg",
        },
    ];

    /// <summary>Pkids treated as referenced by Course / Certification / etc. (delete → conflict).</summary>
    public HashSet<short> InUse { get; } = [1];

    public IReadOnlyList<Partner> Items
    {
        get { lock (_lock) return _items.Select(Clone).ToList(); }
    }

    public Task<IEnumerable<Partner>> GetAllAsync()
    {
        lock (_lock)
            return Task.FromResult<IEnumerable<Partner>>(Sort(_items).Select(Clone).ToList());
    }

    public Task<IEnumerable<Partner>> QueryAsync(PartnerQuery query)
    {
        lock (_lock)
        {
            IEnumerable<Partner> q = _items;
            if (!string.IsNullOrWhiteSpace(query.Keyword))
            {
                var k = query.Keyword.Trim();
                q = q.Where(p => new[]
                    {
                        p.Name, p.AppKey, p.NameOnPartnerMenu, p.NameOnCourseDetailPage, p.ImageFilename,
                    }
                    .Any(s => s?.Contains(k, StringComparison.OrdinalIgnoreCase) == true));
            }
            return Task.FromResult<IEnumerable<Partner>>(Sort(q).Select(Clone).ToList());
        }
    }

    public Task<Partner?> GetByIdAsync(short pkid)
    {
        lock (_lock)
        {
            var p = _items.FirstOrDefault(x => x.Pkid == pkid);
            return Task.FromResult(p is null ? null : Clone(p));
        }
    }

    public Task<short> CreateAsync(PartnerRequest request)
    {
        lock (_lock)
        {
            var pkid = _nextPkid++;
            _items.Add(new Partner
            {
                Pkid = pkid,
                Name = request.Name,
                AppKey = request.AppKey,
                NameOnPartnerMenu = request.NameOnPartnerMenu,
                NameOnCourseDetailPage = request.NameOnCourseDetailPage,
                DisplayOrder = request.DisplayOrder,
                ImageFilename = request.ImageFilename,
            });
            return Task.FromResult(pkid);
        }
    }

    public Task<bool> UpdateAsync(PartnerRequest request)
    {
        lock (_lock)
        {
            var existing = _items.FirstOrDefault(x => x.Pkid == request.Pkid);
            if (existing is null) return Task.FromResult(false);
            existing.Name = request.Name;
            existing.AppKey = request.AppKey;
            existing.NameOnPartnerMenu = request.NameOnPartnerMenu;
            existing.NameOnCourseDetailPage = request.NameOnCourseDetailPage;
            existing.DisplayOrder = request.DisplayOrder;
            existing.ImageFilename = request.ImageFilename;
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
                throw new ReferenceConflictException($"合作廠商「{existing.Name}」已被使用，無法刪除");
            _items.Remove(existing);
            return Task.FromResult(true);
        }
    }

    // Mirrors ORDER BY DisplayOrder ASC, pkid DESC
    private static IEnumerable<Partner> Sort(IEnumerable<Partner> items)
        => items.OrderBy(p => p.DisplayOrder).ThenByDescending(p => p.Pkid);

    private static Partner Clone(Partner p) => new()
    {
        Pkid = p.Pkid,
        Name = p.Name,
        AppKey = p.AppKey,
        NameOnPartnerMenu = p.NameOnPartnerMenu,
        NameOnCourseDetailPage = p.NameOnCourseDetailPage,
        DisplayOrder = p.DisplayOrder,
        ImageFilename = p.ImageFilename,
    };
}

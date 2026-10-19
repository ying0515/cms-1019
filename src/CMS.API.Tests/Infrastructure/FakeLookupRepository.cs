using CMS.API.Models;
using CMS.API.Repositories;

namespace CMS.API.Tests.Infrastructure;

/// <summary>ILookupRepository backed by the other fakes, so lookup endpoints reflect their state.</summary>
public class FakeLookupRepository(FakeAppRoleRepository appRoles, FakePublishStatusRepository publishStatuses,
    FakePartnerRepository partners, FakeCourseGroupRepository courseGroups)
    : ILookupRepository
{
    public Task<IEnumerable<AppUserLookup>> GetAppUsersAsync()
        => Task.FromResult<IEnumerable<AppUserLookup>>(appRoles.Users.Values.OrderBy(u => u.UserName).ToList());

    public Task<IEnumerable<PublishStatusLookup>> GetPublishStatusesAsync()
        => Task.FromResult<IEnumerable<PublishStatusLookup>>(publishStatuses.Items
            .OrderBy(s => s.Pkid)
            .Select(s => new PublishStatusLookup { Pkid = s.Pkid, Description = s.Description })
            .ToList());

    public Task<IEnumerable<PartnerLookup>> GetPartnersAsync()
        => Task.FromResult<IEnumerable<PartnerLookup>>(partners.Items
            .OrderBy(p => p.DisplayOrder)
            .ThenBy(p => p.Pkid)
            .Select(p => new PartnerLookup { Pkid = p.Pkid, Name = p.Name })
            .ToList());

    public Task<IEnumerable<CourseGroupLookup>> GetCourseGroupsAsync()
        => Task.FromResult<IEnumerable<CourseGroupLookup>>(courseGroups.Items
            .OrderBy(g => g.Pkid)
            .Select(g => new CourseGroupLookup { Pkid = g.Pkid, Description = g.Description })
            .ToList());
}

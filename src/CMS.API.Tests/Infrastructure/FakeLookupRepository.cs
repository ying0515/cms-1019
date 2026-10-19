using CMS.API.Models;
using CMS.API.Repositories;

namespace CMS.API.Tests.Infrastructure;

/// <summary>ILookupRepository backed by the other fakes, so lookup endpoints reflect their state.</summary>
public class FakeLookupRepository(FakeAppRoleRepository appRoles, FakePublishStatusRepository publishStatuses)
    : ILookupRepository
{
    public Task<IEnumerable<AppUserLookup>> GetAppUsersAsync()
        => Task.FromResult<IEnumerable<AppUserLookup>>(appRoles.Users.Values.OrderBy(u => u.UserName).ToList());

    public Task<IEnumerable<PublishStatusLookup>> GetPublishStatusesAsync()
        => Task.FromResult<IEnumerable<PublishStatusLookup>>(publishStatuses.Items
            .OrderBy(s => s.Pkid)
            .Select(s => new PublishStatusLookup { Pkid = s.Pkid, Description = s.Description })
            .ToList());
}

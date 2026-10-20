using CMS.API.Repositories;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace CMS.API.Tests.Infrastructure;

/// <summary>Hosts CMS.API in-memory with the repositories swapped for fresh fakes per factory.</summary>
public class CmsApiFactory : WebApplicationFactory<Program>
{
    public FakeAppRoleRepository AppRoles { get; } = new();
    public FakePublishStatusRepository PublishStatuses { get; } = new();
    public FakePartnerRepository Partners { get; } = new();
    public FakeCourseGroupRepository CourseGroups { get; } = new();
    public FakeCourseRepository Courses { get; }
    public FakeAppUserRepository AppUsers { get; }
    public FakeSysConfigRepository SysConfig { get; } = new();
    public FakeFeaturedPromoItemRepository FeaturedPromoItems { get; } = new();
    public FakeAgentTokenUsageRepository AgentTokenUsage { get; } = new();

    /// <summary>X-Api-Key accepted by POST /api/agent-token-usage in tests.</summary>
    public const string ApiKey = "test-api-key";

    /// <summary>Pinned to 2026-10-20 03:00 UTC = 2026-10-20 11:00 in Taipei.</summary>
    public FixedTimeProvider Clock { get; } = new(new DateTimeOffset(2026, 10, 20, 3, 0, 0, TimeSpan.Zero));

    public CmsApiFactory()
    {
        Courses = new FakeCourseRepository(Partners, CourseGroups, PublishStatuses);
        AppUsers = new FakeAppUserRepository(AppRoles);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("AgentTokenReport:ApiKey", ApiKey);
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IAppUserRepository>();
            services.AddSingleton<IAppUserRepository>(AppUsers);
            services.RemoveAll<ISysConfigRepository>();
            services.AddSingleton<ISysConfigRepository>(SysConfig);
            services.RemoveAll<IAppRoleRepository>();
            services.AddSingleton<IAppRoleRepository>(AppRoles);
            services.RemoveAll<IPublishStatusRepository>();
            services.AddSingleton<IPublishStatusRepository>(PublishStatuses);
            services.RemoveAll<IPartnerRepository>();
            services.AddSingleton<IPartnerRepository>(Partners);
            services.RemoveAll<ICourseGroupRepository>();
            services.AddSingleton<ICourseGroupRepository>(CourseGroups);
            services.RemoveAll<ICourseRepository>();
            services.AddSingleton<ICourseRepository>(Courses);
            services.RemoveAll<IFeaturedPromoItemRepository>();
            services.AddSingleton<IFeaturedPromoItemRepository>(FeaturedPromoItems);
            services.RemoveAll<IAgentTokenUsageRepository>();
            services.AddSingleton<IAgentTokenUsageRepository>(AgentTokenUsage);
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Clock);
            services.RemoveAll<ILookupRepository>();
            services.AddSingleton<ILookupRepository>(new FakeLookupRepository(
                AppRoles, PublishStatuses, Partners, CourseGroups, Courses, FeaturedPromoItems));
        });
    }
}

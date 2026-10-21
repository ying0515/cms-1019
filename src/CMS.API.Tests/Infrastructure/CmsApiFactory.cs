using CMS.API.Repositories;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace CMS.API.Tests.Infrastructure;

/// <summary>Hosts CMS.API in-memory with the repositories swapped for fresh fakes per factory.</summary>
public class CmsApiFactory : WebApplicationFactory<Program>
{
    public const string TestUserId = "helen";
    private const string SelectorScheme = "TestOrCookie";

    public FakeAppRoleRepository AppRoles { get; } = new();
    public FakePublishStatusRepository PublishStatuses { get; } = new();
    public FakePartnerRepository Partners { get; } = new();
    public FakeCourseGroupRepository CourseGroups { get; } = new();
    public FakeCourseRepository Courses { get; }
    public FakeAppUserRepository AppUsers { get; }
    public FakeSysConfigRepository SysConfig { get; } = new();
    public FakeFeaturedPromoItemRepository FeaturedPromoItems { get; } = new();

    public CmsApiFactory()
    {
        Courses = new FakeCourseRepository(Partners, CourseGroups, PublishStatuses);
        AppUsers = new FakeAppUserRepository(AppRoles);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
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
            services.RemoveAll<ILookupRepository>();
            services.AddSingleton<ILookupRepository>(new FakeLookupRepository(
                AppRoles, PublishStatuses, Partners, CourseGroups, Courses, FeaturedPromoItems));

            // The X-Test-User header picks TestAuthHandler; without it the real cookie scheme runs.
            services.AddAuthentication()
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, null)
                .AddPolicyScheme(SelectorScheme, null, options => options.ForwardDefaultSelector = ctx =>
                    ctx.Request.Headers.ContainsKey(TestAuthHandler.Header)
                        ? TestAuthHandler.SchemeName
                        : CookieAuthenticationDefaults.AuthenticationScheme);
            services.PostConfigure<AuthenticationOptions>(options => options.DefaultScheme = SelectorScheme);
        });
    }

    /// <summary>Every client from CreateClient() is signed in as <see cref="TestUserId"/>.</summary>
    protected override void ConfigureClient(HttpClient client)
    {
        base.ConfigureClient(client);
        client.DefaultRequestHeaders.Add(TestAuthHandler.Header, TestUserId);
    }

    /// <summary>A client with no test sign-in: it goes through the real cookie login (keeps cookies).</summary>
    public HttpClient CreateAnonymousClient()
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Remove(TestAuthHandler.Header);
        return client;
    }
}

using CMS.API.Repositories;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace CMS.API.Tests.Infrastructure;

/// <summary>Hosts CMS.API in-memory with the repository swapped for a fresh fake per factory.</summary>
public class CmsApiFactory : WebApplicationFactory<Program>
{
    public FakeAppRoleRepository AppRoles { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IAppRoleRepository>();
            services.AddSingleton<IAppRoleRepository>(AppRoles);
        });
    }
}

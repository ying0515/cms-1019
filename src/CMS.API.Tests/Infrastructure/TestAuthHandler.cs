using System.Text.Encodings.Web;
using CMS.API.Auth;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace CMS.API.Tests.Infrastructure;

/// <summary>
/// Signs a request in as the user named in the <see cref="Header"/> header (a fake AppUser UserId),
/// so CRUD tests skip the login round trip. Requests without the header use the real cookie scheme.
/// </summary>
public class TestAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IAppUserRepository users)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "Test";
    public const string Header = "X-Test-User";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var userId = Request.Headers[Header].ToString();
        var user = await users.GetCredentialAsync(userId);
        if (user is null) return AuthenticateResult.Fail($"Unknown test user '{userId}'");

        var principal = CmsAuth.CreatePrincipal(user, SchemeName, user.MustChangePassword);
        return AuthenticateResult.Success(new AuthenticationTicket(principal, SchemeName));
    }
}

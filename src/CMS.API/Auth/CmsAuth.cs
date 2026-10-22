using System.Globalization;
using System.Security.Claims;
using System.Threading.RateLimiting;
using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace CMS.API.Auth;

/// <summary>
/// Cookie sign-in for the back office. Every endpoint requires a signed-in user whose password is
/// not a default one (fallback policy); AuthController opts out with [AllowAnonymous] / SignedInPolicy.
/// </summary>
public static class CmsAuth
{
    /// <summary>Signed in, even with MustChangePassword: GET me, change-password.</summary>
    public const string SignedInPolicy = "SignedIn";
    /// <summary>The fallback policy plus the Admin role: user and role management.</summary>
    public const string AdminPolicy = "Admin";
    /// <summary>AppRole.RoleId that grants <see cref="AdminPolicy"/>.</summary>
    public const string AdminRoleId = "Admin";
    public const string MustChangePasswordClaim = "cms:must_change_password";
    public const string PasswordStampClaim = "cms:password_stamp";
    public const string CookieName = "CMS.Auth";
    /// <summary>[EnableRateLimiting] on login: <see cref="LoginsPerMinutePerIp"/> attempts per client IP.</summary>
    public const string LoginRateLimitPolicy = "Login";
    public const int LoginsPerMinutePerIp = 20;
    public const string TooManyAttempts = "登入嘗試次數過多，請稍後再試";

    public static IServiceCollection AddCmsAuth(this IServiceCollection services)
    {
        services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(options =>
            {
                options.Cookie.Name = CookieName;
                options.Cookie.HttpOnly = true;
                // :4200 and :5000 are the same site, so Strict still sends the cookie to the API.
                options.Cookie.SameSite = SameSiteMode.Strict;
                options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
                options.ExpireTimeSpan = TimeSpan.FromHours(8);
                options.SlidingExpiration = true;
                options.Events = new CookieAuthenticationEvents
                {
                    // An API: answer 401 / 403 instead of redirecting to a login page.
                    OnRedirectToLogin = ctx => SetStatus(ctx, StatusCodes.Status401Unauthorized),
                    OnRedirectToAccessDenied = ctx => SetStatus(ctx, StatusCodes.Status403Forbidden),
                    OnValidatePrincipal = ValidateSessionAsync,
                };
            });

        var signedInWithOwnPassword = new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .RequireAssertion(ctx => !ctx.User.HasClaim(MustChangePasswordClaim, "true"))
            .Build();

        services.AddAuthorizationBuilder()
            .SetFallbackPolicy(signedInWithOwnPassword)
            .AddPolicy(SignedInPolicy, policy => policy.RequireAuthenticatedUser())
            // An [Authorize] policy replaces the fallback, so Admin repeats its requirements.
            .AddPolicy(AdminPolicy, policy => policy.Combine(signedInWithOwnPassword).RequireRole(AdminRoleId));

        services.TryAddSingleton(TimeProvider.System);
        services.AddSingleton<LoginThrottle>();
        services.AddRateLimiter(options =>
        {
            options.AddPolicy(LoginRateLimitPolicy, ctx => RateLimitPartition.GetFixedWindowLimiter(
                ctx.Connection.RemoteIpAddress?.ToString() ?? "",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = LoginsPerMinutePerIp, Window = TimeSpan.FromMinutes(1) }));
            options.OnRejected = (ctx, token) =>
            {
                ctx.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                return new ValueTask(ctx.HttpContext.Response.WriteAsJsonAsync(
                    new { message = TooManyAttempts }, token));
            };
        });

        return services;
    }

    public static ClaimsPrincipal CreatePrincipal(AppUserCredential user, string scheme, bool mustChangePassword)
    {
        var identity = new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, user.Pkid.ToString(CultureInfo.InvariantCulture)),
            new Claim(ClaimTypes.Name, user.UserId),
            new Claim(MustChangePasswordClaim, mustChangePassword ? "true" : "false"),
            new Claim(PasswordStampClaim, PasswordStamp(user)),
            .. user.RoleIds.Select(roleId => new Claim(ClaimTypes.Role, roleId)),
        ], scheme);
        return new ClaimsPrincipal(identity);
    }

    public static bool IsAdmin(AppUserCredential user) => user.RoleIds.Contains(AdminRoleId);

    public static int? UserPkid(ClaimsPrincipal principal)
        => int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), CultureInfo.InvariantCulture, out var pkid)
            ? pkid
            : null;

    public static bool MustChangePassword(ClaimsPrincipal principal)
        => principal.HasClaim(MustChangePasswordClaim, "true");

    // PasswordUpdatedTime changes on create, reset and change, so it doubles as a session stamp.
    private static string PasswordStamp(AppUserCredential user)
        => user.PasswordUpdatedTime?.Ticks.ToString(CultureInfo.InvariantCulture) ?? "";

    // Runs on every request: a deactivated, deleted or re-passworded user loses the session at once,
    // and the roles come from the database, not the cookie, so a role change applies at once too.
    private static async Task ValidateSessionAsync(CookieValidatePrincipalContext ctx)
    {
        var pkid = ctx.Principal is null ? null : UserPkid(ctx.Principal);
        var users = ctx.HttpContext.RequestServices.GetRequiredService<IAppUserRepository>();
        var user = pkid is null ? null : await users.GetCredentialAsync(pkid.Value);

        if (user is null || !user.IsActive
            || ctx.Principal!.FindFirstValue(PasswordStampClaim) != PasswordStamp(user))
        {
            ctx.RejectPrincipal();
            await ctx.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return;
        }

        ctx.ReplacePrincipal(CreatePrincipal(user, ctx.Scheme.Name, MustChangePassword(ctx.Principal)));
    }

    private static Task SetStatus(RedirectContext<CookieAuthenticationOptions> ctx, int status)
    {
        ctx.Response.StatusCode = status;
        return Task.CompletedTask;
    }
}

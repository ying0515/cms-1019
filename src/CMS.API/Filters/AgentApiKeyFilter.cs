using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace CMS.API.Filters;

/// <summary>
/// Requires the X-Api-Key header to match AgentTokenReport:ApiKey (constant-time compare).
/// An authorization filter, so it runs before [ApiController] model validation: no key → 401 even for a bad body.
/// </summary>
public class AgentApiKeyFilter(IConfiguration config) : IAuthorizationFilter
{
    public const string HeaderName = "X-Api-Key";
    public const string ConfigKey = "AgentTokenReport:ApiKey";

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var expected = config[ConfigKey];
        var actual = context.HttpContext.Request.Headers[HeaderName].ToString();
        // No configured key → nothing can authenticate
        if (string.IsNullOrEmpty(expected) || !CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(actual), Encoding.UTF8.GetBytes(expected)))
        {
            context.Result = new UnauthorizedResult();
        }
    }
}

/// <summary>Applies <see cref="AgentApiKeyFilter"/> to one action.</summary>
public class RequireAgentApiKeyAttribute() : TypeFilterAttribute(typeof(AgentApiKeyFilter));

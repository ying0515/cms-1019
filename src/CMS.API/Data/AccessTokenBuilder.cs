using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace CMS.API.Data;

public static class AccessTokenBuilder
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromHours(24);

    /// <summary>HS256 needs a key of at least 256 bits.</summary>
    public const int MinKeyBytes = 32;

    public const string UserIdClaim = JwtRegisteredClaimNames.Sub;
    public const string UserNameClaim = JwtRegisteredClaimNames.Name;
    public const string RoleClaim = "role";

    /// <summary>HS256 JWT: sub = UserId, name = UserName, one role claim per RoleId; expires <see cref="Lifetime"/> after <paramref name="now"/>.</summary>
    public static string Build(string userId, string userName, IEnumerable<string> roleIds, string secret, DateTimeOffset now)
    {
        var claims = new List<Claim> { new(UserIdClaim, userId), new(UserNameClaim, userName) };
        claims.AddRange(roleIds.Select(roleId => new Claim(RoleClaim, roleId)));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        return new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            IssuedAt = now.UtcDateTime,
            NotBefore = now.UtcDateTime,
            Expires = now.Add(Lifetime).UtcDateTime,
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256),
        });
    }
}

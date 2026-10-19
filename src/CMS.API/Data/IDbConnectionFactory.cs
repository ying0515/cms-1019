using System.Data;

namespace CMS.API.Data;

public interface IDbConnectionFactory
{
    Task<IDbConnection> CreateOpenConnectionAsync();
}

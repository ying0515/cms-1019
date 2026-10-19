using System.Data;
using Microsoft.Data.SqlClient;

namespace CMS.API.Data;

public class SqlConnectionFactory(IConfiguration configuration) : IDbConnectionFactory
{
    private readonly string _connectionString = configuration.GetConnectionString("CMS")
        ?? throw new InvalidOperationException("Connection string 'CMS' is not configured.");

    public async Task<IDbConnection> CreateOpenConnectionAsync()
    {
        var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();
        return connection;
    }
}

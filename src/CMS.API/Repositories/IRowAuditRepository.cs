using CMS.API.Models;

namespace CMS.API.Repositories;

public interface IRowAuditRepository
{
    /// <summary>The record's history, newest first.</summary>
    Task<IEnumerable<RowAuditEntry>> GetHistoryAsync(string tableName, string pkid);
}

using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/rowaudit")]
public class RowAuditController(IRowAuditRepository repository) : ControllerBase
{
    /// <summary>GET /api/rowaudit?tableName=Course&amp;pkid=123 → that record's history, newest first.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<RowAuditEntry>>> GetHistory([FromQuery] RowAuditQuery query)
        => Ok(await repository.GetHistoryAsync(query.TableName.Trim(), query.Pkid.Trim()));
}

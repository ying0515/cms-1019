using CMS.API.Data;
using CMS.API.Filters;
using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/agent-token-usage")]
public class AgentTokenUsageController(IAgentTokenUsageRepository repository, TimeProvider clock) : ControllerBase
{
    // Taiwan has no DST, so Asia/Taipei is always UTC+8 (same rule the client uses to date messages)
    private static readonly TimeSpan TaipeiOffset = TimeSpan.FromHours(8);

    /// <summary>Saves a session's absolute totals; resubmitting overwrites, rows not in the payload are untouched.</summary>
    [HttpPost]
    [AllowAnonymous] // no JWT: the token-report client authenticates with X-Api-Key only
    [RequireAgentApiKey]
    public async Task<IActionResult> Submit([FromBody] AgentTokenUsageSubmitRequest request)
    {
        if (request.Items.Any(i => i is null)) return BadRequest(new { message = "用量項目不可為空" });
        Normalize(request);

        var isActive = await repository.GetUserIsActiveAsync(request.UserId);
        if (isActive is null) return BadRequest(new { message = $"使用者 {request.UserId} 不存在" });
        if (isActive is false) return BadRequest(new { message = $"使用者 {request.UserId} 已停用" });

        var today = DateOnly.FromDateTime(clock.GetUtcNow().ToOffset(TaipeiOffset).DateTime);
        var future = request.Items.FirstOrDefault(i => i.UsageDate > today);
        if (future is not null)
            return BadRequest(new { message = $"日期 {future.UsageDate:yyyy-MM-dd} 晚於今天 {today:yyyy-MM-dd}（台北時間）" });

        var duplicate = request.Items
            .GroupBy(i => (i.UsageDate, i.Model))
            .FirstOrDefault(g => g.Count() > 1);
        if (duplicate is not null)
            return BadRequest(new { message = $"日期 {duplicate.Key.UsageDate:yyyy-MM-dd} 與模型 {duplicate.Key.Model} 重複" });

        try
        {
            await repository.UpsertAsync(request, CostCalculator.Cost);
        }
        catch (InvalidReferenceException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        return NoContent();
    }

    [HttpPost("report")]
    public async Task<ActionResult<IEnumerable<AgentTokenUsageReportRow>>> Report([FromBody] AgentTokenUsageReportQuery query)
        => Ok(await repository.ReportAsync(query));

    private static void Normalize(AgentTokenUsageSubmitRequest r)
    {
        r.SessionId = r.SessionId.Trim();
        r.UserId = r.UserId.Trim();
        r.Project = r.Project.Trim();
        foreach (var item in r.Items) item.Model = item.Model.Trim();
    }
}

using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

[ApiController]
[Route("api/featured-promo-items")]
public class FeaturedPromoItemsController(IFeaturedPromoItemRepository repository) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<FeaturedPromoItem>>> GetAll()
        => Ok(await repository.GetAllAsync());

    [HttpPost("query")]
    public async Task<ActionResult<IEnumerable<FeaturedPromoItem>>> Query([FromBody] FeaturedPromoItemQuery query)
        => Ok(await repository.QueryAsync(query));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<FeaturedPromoItem>> GetById(int id)
    {
        var item = await repository.GetByIdAsync(id);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<FeaturedPromoItem>> Create([FromBody] FeaturedPromoItemRequest request)
    {
        Normalize(request);
        try
        {
            var pkid = await repository.CreateAsync(request);
            var created = await repository.GetByIdAsync(pkid);
            return CreatedAtAction(nameof(GetById), new { id = pkid }, created);
        }
        catch (InvalidReferenceException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (DuplicateKeyException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] FeaturedPromoItemRequest request)
    {
        Normalize(request);
        try
        {
            var updated = await repository.UpdateAsync(request);
            return updated ? NoContent() : NotFound();
        }
        catch (InvalidReferenceException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (DuplicateKeyException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
        => await repository.DeleteAsync(id) ? NoContent() : NotFound();

    /// <summary>"+": Slot n → n+1, swapping with the item already there.</summary>
    [HttpPost("{id:int}/move-down")]
    public Task<IActionResult> MoveDown(int id) => Move(id, +1);

    /// <summary>"−": Slot n → n−1, swapping with the item already there.</summary>
    [HttpPost("{id:int}/move-up")]
    public Task<IActionResult> MoveUp(int id) => Move(id, -1);

    private async Task<IActionResult> Move(int id, int offset)
    {
        var item = await repository.GetByIdAsync(id);
        if (item is null) return NotFound();

        var target = item.Slot + offset;
        if (target < 1) return BadRequest(new { message = "已是第 1 則，無法上移" });
        if (target > FeaturedPromoItemRequest.MaxSlot)
            return BadRequest(new { message = $"已是第 {FeaturedPromoItemRequest.MaxSlot} 則，無法下移" });

        return await repository.MoveToSlotAsync(id, (byte)target) ? NoContent() : NotFound();
    }

    private static void Normalize(FeaturedPromoItemRequest request)
    {
        request.Topic = request.Topic.Trim();
        request.Description = request.Description.Trim();
    }
}

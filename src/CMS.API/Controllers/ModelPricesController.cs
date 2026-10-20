using CMS.API.Data;
using CMS.API.Models;
using CMS.API.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Controllers;

/// <summary>Model price list; every write re-prices that model's AgentTokenUsage rows.</summary>
[ApiController]
[Route("api/model-prices")]
public class ModelPricesController(IModelPriceRepository repository) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ModelPrice>>> GetAll()
        => Ok(await repository.GetAllAsync());

    [HttpPost("query")]
    public async Task<ActionResult<IEnumerable<ModelPrice>>> Query([FromBody] ModelPriceQuery query)
        => Ok(await repository.QueryAsync(query));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ModelPrice>> GetById(int id)
    {
        var item = await repository.GetByIdAsync(id);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<ModelPrice>> Create([FromBody] ModelPriceRequest request)
    {
        Normalize(request);
        try
        {
            var pkid = await repository.CreateAsync(request, CostCalculator.Cost);
            var created = await repository.GetByIdAsync(pkid);
            return CreatedAtAction(nameof(GetById), new { id = pkid }, created);
        }
        catch (DuplicateKeyException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] ModelPriceRequest request)
    {
        Normalize(request);
        try
        {
            var updated = await repository.UpdateAsync(request, CostCalculator.Cost);
            return updated ? NoContent() : NotFound();
        }
        catch (DuplicateKeyException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
        => await repository.DeleteAsync(id, CostCalculator.Cost) ? NoContent() : NotFound();

    private static void Normalize(ModelPriceRequest request)
    {
        request.Model = request.Model.Trim();
    }
}

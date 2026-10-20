using CMS.API.Data;
using CMS.API.Models;

namespace CMS.API.Repositories;

/// <summary>
/// ModelPrice CRUD. Every write also re-prices the AgentTokenUsage rows of the affected model(s)
/// with <paramref name="cost"/>, in the same transaction.
/// </summary>
public interface IModelPriceRepository
{
    Task<IEnumerable<ModelPrice>> GetAllAsync();
    Task<IEnumerable<ModelPrice>> QueryAsync(ModelPriceQuery query);
    Task<ModelPrice?> GetByIdAsync(int pkid);
    /// <returns>The new IDENTITY pkid.</returns>
    /// <exception cref="DuplicateKeyException">The model already has a price on that date.</exception>
    Task<int> CreateAsync(ModelPriceRequest request, CostFunction cost);
    /// <summary>Re-prices both the old and the new model when the name changes.</summary>
    /// <exception cref="DuplicateKeyException">The model already has a price on that date.</exception>
    Task<bool> UpdateAsync(ModelPriceRequest request, CostFunction cost);
    /// <summary>Usage of the model falls back to an earlier price, or to no cost.</summary>
    Task<bool> DeleteAsync(int pkid, CostFunction cost);
}

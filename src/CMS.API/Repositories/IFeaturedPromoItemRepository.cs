using CMS.API.Models;

namespace CMS.API.Repositories;

public interface IFeaturedPromoItemRepository
{
    Task<IEnumerable<FeaturedPromoItem>> GetAllAsync();
    Task<IEnumerable<FeaturedPromoItem>> QueryAsync(FeaturedPromoItemQuery query);
    Task<FeaturedPromoItem?> GetByIdAsync(int pkid);
    /// <returns>The new IDENTITY pkid.</returns>
    /// <exception cref="InvalidReferenceException">The TrainingCenter / Promotion2 does not exist.</exception>
    /// <exception cref="DuplicateKeyException">The date / training center / slot is already taken.</exception>
    Task<int> CreateAsync(FeaturedPromoItemRequest request);
    /// <exception cref="InvalidReferenceException">The TrainingCenter / Promotion2 does not exist.</exception>
    /// <exception cref="DuplicateKeyException">The date / training center / slot is already taken.</exception>
    Task<bool> UpdateAsync(FeaturedPromoItemRequest request);
    Task<bool> DeleteAsync(int pkid);
    /// <summary>
    /// Moves the item to <paramref name="targetSlot"/> on the same day and training center,
    /// swapping with the item already there (if any).
    /// </summary>
    Task<bool> MoveToSlotAsync(int pkid, byte targetSlot);
}

using CMS.API.Models;

namespace CMS.API.Data;

/// <summary>
/// Prices <paramref name="usage"/> from <paramref name="prices"/>; null when no price applies.
/// Repositories receive this instead of computing cost themselves, so they only read and write.
/// </summary>
public delegate decimal? CostFunction(IEnumerable<ModelPrice> prices, UsageTokens usage);

/// <summary>The one cost rule, shared by usage ingest and the ModelPrice recompute.</summary>
public static class CostCalculator
{
    private const decimal TokensPerPrice = 1_000_000m;

    /// <summary>
    /// Uses the price with the latest EffectiveFrom on or before the usage date for the usage's model
    /// (case-insensitive, like the database collation). Rounded to the Cost column's 6 decimals.
    /// </summary>
    public static decimal? Cost(IEnumerable<ModelPrice> prices, UsageTokens usage)
    {
        var price = prices
            .Where(p => string.Equals(p.Model, usage.Model, StringComparison.OrdinalIgnoreCase)
                && p.EffectiveFrom <= usage.UsageDate)
            .MaxBy(p => p.EffectiveFrom);
        if (price is null) return null;

        var cost = (usage.InputTokens * price.InputPrice
            + usage.OutputTokens * price.OutputPrice
            + usage.CacheWriteTokens * price.CacheWritePrice
            + usage.CacheReadTokens * price.CacheReadPrice) / TokensPerPrice;
        return Math.Round(cost, 6, MidpointRounding.AwayFromZero);
    }
}

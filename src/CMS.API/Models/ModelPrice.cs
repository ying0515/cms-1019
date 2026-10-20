namespace CMS.API.Models;

/// <summary>USD list price per 1M tokens for one model, from EffectiveFrom until the next price of that model.</summary>
public class ModelPrice
{
    public int Pkid { get; set; }
    public string Model { get; set; } = string.Empty;
    public DateOnly EffectiveFrom { get; set; }
    public decimal InputPrice { get; set; }
    public decimal OutputPrice { get; set; }
    public decimal CacheWritePrice { get; set; }
    public decimal CacheReadPrice { get; set; }
}

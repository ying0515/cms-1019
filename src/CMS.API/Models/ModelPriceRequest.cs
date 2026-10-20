using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

public class ModelPriceRequest
{
    // decimal(18,6) upper bound for the price columns
    private const string MaxPrice = "999999999999.999999";

    // IDENTITY: ignored on create, identifies the row on update
    public int Pkid { get; set; }

    [Required, StringLength(100)]
    public string Model { get; set; } = string.Empty;

    // Nullable so a missing value is a 400 instead of 0001-01-01 / 0
    [Required]
    public DateOnly? EffectiveFrom { get; set; }

    [Required, Range(typeof(decimal), "0", MaxPrice)]
    public decimal? InputPrice { get; set; }

    [Required, Range(typeof(decimal), "0", MaxPrice)]
    public decimal? OutputPrice { get; set; }

    [Required, Range(typeof(decimal), "0", MaxPrice)]
    public decimal? CacheWritePrice { get; set; }

    [Required, Range(typeof(decimal), "0", MaxPrice)]
    public decimal? CacheReadPrice { get; set; }
}

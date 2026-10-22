namespace CMS.API.Models;

/// <summary>Promotion2 slim row; Topic / Description prefill a FeaturedPromoItem.</summary>
public class PromotionLookup
{
    public int Pkid { get; set; }
    public string PromoCode { get; set; } = string.Empty;
    public string Topic { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

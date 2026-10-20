namespace CMS.API.Models;

public class ModelPriceQuery
{
    /// <summary>LIKE on Model.</summary>
    public string? Keyword { get; set; }
    /// <summary>Inclusive EffectiveFrom range.</summary>
    public DateOnly? EffectiveFromFrom { get; set; }
    public DateOnly? EffectiveFromTo { get; set; }
}

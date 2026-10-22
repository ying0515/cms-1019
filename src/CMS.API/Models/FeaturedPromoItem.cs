namespace CMS.API.Models;

public class FeaturedPromoItem
{
    public int Pkid { get; set; }
    public DateOnly ScheduleOn { get; set; }
    public short TrainingCenterPkid { get; set; }
    public byte Slot { get; set; }
    public int PromotionPkid { get; set; }
    public string Topic { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    // FK nav objects (multi-map)
    public TrainingCenterLookup? TrainingCenter { get; set; }
    public PromotionLookup? Promotion { get; set; }
}

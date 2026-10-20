using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

public class FeaturedPromoItemRequest
{
    /// <summary>Slots per day and training center (UNIQUE ScheduleOn + TrainingCenter_pkid + Slot).</summary>
    public const byte MaxSlot = 3;

    // IDENTITY: ignored on create, identifies the row on update
    public int Pkid { get; set; }

    // Nullable so a missing date is a 400 instead of 0001-01-01
    [Required]
    public DateOnly? ScheduleOn { get; set; }

    [Range(1, short.MaxValue)]
    public short TrainingCenterPkid { get; set; }

    [Range(1, MaxSlot)]
    public byte Slot { get; set; }

    [Range(1, int.MaxValue)]
    public int PromotionPkid { get; set; }

    [Required, StringLength(100)]
    public string Topic { get; set; } = string.Empty;

    [Required, StringLength(300)]
    public string Description { get; set; } = string.Empty;
}

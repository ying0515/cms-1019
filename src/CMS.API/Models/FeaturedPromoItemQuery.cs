namespace CMS.API.Models;

public class FeaturedPromoItemQuery
{
    public short? TrainingCenterPkid { get; set; }
    /// <summary>Any day of the week to show; filters ScheduleOn to that week's Monday–Sunday.</summary>
    public DateOnly? WeekOf { get; set; }

    /// <summary>Monday of the week containing <paramref name="date"/>.</summary>
    public static DateOnly WeekStart(DateOnly date)
        => date.AddDays(-(((int)date.DayOfWeek + 6) % 7));
}

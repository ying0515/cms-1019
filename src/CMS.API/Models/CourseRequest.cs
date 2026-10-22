using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace CMS.API.Models;

public class CourseRequest : IValidatableObject
{
    // IDENTITY: ignored on create, identifies the row on update
    [JsonRequired]
    public int Pkid { get; set; }

    [Required, StringLength(200)]
    public string Title { get; set; } = string.Empty;

    [StringLength(300)]
    public string? OfficialTitle { get; set; }

    [Required, StringLength(50)]
    public string CourseId { get; set; } = string.Empty;

    [Required, StringLength(50)]
    public string ProdCourseId { get; set; } = string.Empty;

    [Required, StringLength(100)]
    public string FriendlyUrl { get; set; } = string.Empty;

    [JsonRequired]
    public int DisplayOrder { get; set; }

    [Range(1, short.MaxValue)]
    public short PartnerPkid { get; set; }

    public short? CourseGroupPkid { get; set; }

    [Range(1, byte.MaxValue)]
    public byte PublishStatusPkid { get; set; }

    // Nullable so a missing date is a 400 instead of 0001-01-01
    [Required]
    public DateOnly? ScheduleOn { get; set; }

    [Required]
    public DateOnly? ScheduleOff { get; set; }

    [Range(0, short.MaxValue)]
    public short Hour { get; set; }

    // decimal(9, 0)
    [Range(typeof(decimal), "0", "999999999")]
    public decimal ListPrice { get; set; }

    // decimal(9, 1)
    [Range(typeof(decimal), "0", "99999999.9")]
    public decimal LearningCredit { get; set; }

    [StringLength(500)]
    public string? Material { get; set; }

    [StringLength(4000)]
    public string? Objective { get; set; }

    [StringLength(500)]
    public string? Target { get; set; }

    [StringLength(4000)]
    public string? Prerequisites { get; set; }

    public string? Outline { get; set; }

    public string? TowardCertOrExam { get; set; }

    [StringLength(4000)]
    public string? Note { get; set; }

    [StringLength(4000)]
    public string? OtherInfo { get; set; }

    [JsonRequired]
    public bool CanRepeat { get; set; }

    // n-n CourseInCertification
    public List<int> CertificationPkids { get; set; } = [];

    // n-n CourseJobCategories
    public List<short> JobCategoryPkids { get; set; } = [];

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (ScheduleOn.HasValue && ScheduleOff.HasValue && ScheduleOff < ScheduleOn)
            yield return new ValidationResult("下架日期不可早於上架日期", [nameof(ScheduleOff)]);
    }
}

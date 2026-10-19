using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

public class PartnerRequest
{
    // IDENTITY: ignored on create, identifies the row on update
    public short Pkid { get; set; }

    [Required, StringLength(50)]
    public string Name { get; set; } = string.Empty;

    [Required, StringLength(10)]
    public string AppKey { get; set; } = string.Empty;

    [Required, StringLength(200)]
    public string NameOnPartnerMenu { get; set; } = string.Empty;

    [Required, StringLength(50)]
    public string NameOnCourseDetailPage { get; set; } = string.Empty;

    public int DisplayOrder { get; set; }

    [StringLength(50)]
    public string? ImageFilename { get; set; }
}

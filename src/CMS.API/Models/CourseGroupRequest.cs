using System.ComponentModel.DataAnnotations;

namespace CMS.API.Models;

public class CourseGroupRequest
{
    // IDENTITY: ignored on create, identifies the row on update
    public short Pkid { get; set; }

    [Required, StringLength(100)]
    public string Description { get; set; } = string.Empty;
}

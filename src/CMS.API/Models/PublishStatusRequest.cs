using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace CMS.API.Models;

public class PublishStatusRequest
{
    // Not IDENTITY: user-supplied on create, immutable on update
    [JsonRequired]
    public byte Pkid { get; set; }

    [Required, StringLength(50)]
    public string Description { get; set; } = string.Empty;

    [JsonRequired]
    public bool IsDraft { get; set; }
    [JsonRequired]
    public bool IsPublished { get; set; }
    [JsonRequired]
    public bool IsDiscontinued { get; set; }
}

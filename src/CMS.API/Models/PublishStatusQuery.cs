namespace CMS.API.Models;

public class PublishStatusQuery
{
    // LIKE on Description
    public string? Keyword { get; set; }
    public bool? IsDraft { get; set; }
    public bool? IsPublished { get; set; }
    public bool? IsDiscontinued { get; set; }
}

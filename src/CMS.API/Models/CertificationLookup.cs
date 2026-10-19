namespace CMS.API.Models;

public class CertificationLookup
{
    public int Pkid { get; set; }
    // nchar(100) NULL: RTRIM() in SQL
    public string? Title { get; set; }
    public short PartnerPkid { get; set; }
    public string PartnerName { get; set; } = string.Empty;
}

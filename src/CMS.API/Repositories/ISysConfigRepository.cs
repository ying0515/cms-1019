namespace CMS.API.Repositories;

public interface ISysConfigRepository
{
    /// <summary>SysConfig.configValue for the key, or null if the row does not exist.</summary>
    Task<string?> GetValueAsync(string configKey);
}

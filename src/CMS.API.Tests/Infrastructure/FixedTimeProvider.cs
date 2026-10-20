namespace CMS.API.Tests.Infrastructure;

/// <summary>A clock pinned to <see cref="Now"/> (UTC) so "today in Taipei" is deterministic.</summary>
public class FixedTimeProvider(DateTimeOffset now) : TimeProvider
{
    public DateTimeOffset Now { get; set; } = now;

    public override DateTimeOffset GetUtcNow() => Now;
}

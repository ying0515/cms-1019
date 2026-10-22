namespace CMS.API.Tests.Infrastructure;

/// <summary>A TimeProvider that only moves when a test calls <see cref="Advance"/>.</summary>
public class ManualClock : TimeProvider
{
    private DateTimeOffset _now = new(2026, 1, 5, 9, 0, 0, TimeSpan.Zero);

    public override DateTimeOffset GetUtcNow() => _now;

    public void Advance(TimeSpan by) => _now += by;
}

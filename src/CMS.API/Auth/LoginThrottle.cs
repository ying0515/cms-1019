using System.Collections.Concurrent;

namespace CMS.API.Auth;

/// <summary>
/// Per-account login lockout: <see cref="MaxFailures"/> wrong passwords within <see cref="Window"/>
/// lock that UserId for another <see cref="Window"/>. Unknown UserIds count too, so a lockout reveals nothing.
/// In memory (one API instance); the per-IP rate limit in <see cref="CmsAuth"/> caps total attempts.
/// </summary>
public class LoginThrottle(TimeProvider clock)
{
    public const int MaxFailures = 5;
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(15);
    // UserIds are attacker-chosen: past this many, expired entries are dropped, then new ones untracked.
    private const int MaxTracked = 10_000;

    private sealed record Entry(int Failures, DateTimeOffset WindowStart);

    private readonly ConcurrentDictionary<string, Entry> _entries = new(StringComparer.OrdinalIgnoreCase);

    public bool IsLockedOut(string userId)
        => _entries.TryGetValue(userId, out var e) && e.Failures >= MaxFailures && !Expired(e);

    public void RecordFailure(string userId)
    {
        if (!_entries.ContainsKey(userId) && _entries.Count >= MaxTracked)
        {
            foreach (var (key, e) in _entries)
                if (Expired(e)) _entries.TryRemove(key, out _);
            if (_entries.Count >= MaxTracked) return;
        }

        _entries.AddOrUpdate(
            userId,
            _ => new Entry(1, clock.GetUtcNow()),
            (_, e) => Expired(e) ? new Entry(1, clock.GetUtcNow())
                // The failure that locks the account restarts the clock: the lockout lasts a full Window.
                : e.Failures + 1 == MaxFailures ? new Entry(MaxFailures, clock.GetUtcNow())
                : e with { Failures = e.Failures + 1 });
    }

    public void Reset(string userId) => _entries.TryRemove(userId, out _);

    private bool Expired(Entry e) => clock.GetUtcNow() - e.WindowStart >= Window;
}

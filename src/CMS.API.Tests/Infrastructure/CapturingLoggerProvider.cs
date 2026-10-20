using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace CMS.API.Tests.Infrastructure;

/// <summary>Keeps every log entry in memory so tests can assert what the server logged.</summary>
public sealed class CapturingLoggerProvider : ILoggerProvider
{
    public record Entry(string Category, LogLevel Level, string Message, Exception? Exception);

    public ConcurrentQueue<Entry> Entries { get; } = new();

    public ILogger CreateLogger(string categoryName) => new Logger(categoryName, Entries);

    public void Dispose() { }

    private sealed class Logger(string category, ConcurrentQueue<Entry> entries) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter)
            => entries.Enqueue(new Entry(category, logLevel, formatter(state, exception), exception));
    }
}

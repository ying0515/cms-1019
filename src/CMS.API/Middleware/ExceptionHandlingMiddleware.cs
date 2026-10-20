using System.Diagnostics;

namespace CMS.API.Middleware;

/// <summary>
/// Last line of defence: any exception a controller or repository did not turn into a response
/// (business errors such as <c>ReferenceConflictException</c> are mapped to 400 / 409 in the controllers)
/// is logged in full here and answered with one generic 500 body. The body never carries the exception text,
/// which can hold SQL, connection details or stack frames.
/// </summary>
public class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    /// <summary>Shown to the user by the Angular interceptor as is.</summary>
    public const string SafeMessage = "發生未預期的錯誤，請稍後再試。 An unexpected error occurred.";

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // The client went away; there is nobody to answer and nothing went wrong on our side.
            logger.LogDebug("Request aborted by the client: {Method} {Path}", context.Request.Method, context.Request.Path);
        }
        catch (Exception ex)
        {
            var traceId = Activity.Current?.Id ?? context.TraceIdentifier;
            logger.LogError(ex, "Unhandled exception for {Method} {Path} (traceId {TraceId})",
                context.Request.Method, context.Request.Path, traceId);

            // Headers and part of the body are already sent: the status cannot change, so let the server abort.
            if (context.Response.HasStarted) throw;

            // No Response.Clear(): it would also drop the CORS headers, and the browser would then report
            // a network error (status 0) instead of this 500.
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentLength = null;
            await context.Response.WriteAsJsonAsync(new ErrorResponse(SafeMessage, traceId));
        }
    }

    /// <summary>`message` is what <c>httpErrorMessage()</c> reads; `traceId` matches the server log line.</summary>
    public record ErrorResponse(string Message, string TraceId);
}

using System.Data;
using System.Globalization;
using System.Reflection;
using System.Security.Claims;
using CMS.API.Models;
using Dapper;

namespace CMS.API.Data;

/// <summary>
/// Writes one RowAudit row per Insert / Update / Delete on any entity, read by reflection:
/// PrimaryKeyValues = the `pkid` property; ActionDesc = the first string property (Insert / Delete)
/// or the comma-separated names of the changed properties (Update). Repositories call it after the write,
/// passing their transaction so the audit row commits or rolls back with the change.
/// </summary>
public class RowAuditWriter(IDbConnectionFactory db, IHttpContextAccessor http, TimeProvider clock)
{
    public const string SystemUser = "system";
    public const int MaxActionDescLength = 1000;

    // Explicit CASTs truncate silently: the DB is Big5 (Chinese_Taiwan_Stroke_CI_AS), so varchar(1000) holds 1000 bytes,
    // and 1000 Chinese characters would otherwise fail the insert. UserName can be up to 200 chars in AppUser.
    private const string InsertSql = """
        INSERT INTO RowAudit (TableName, UserName, PrimaryKeyValues, ActionType, ActionDesc, [DateTime])
        VALUES (@TableName, CAST(@UserName AS nvarchar(100)), CAST(@PrimaryKeyValues AS nvarchar(100)), @ActionType,
                CAST(CAST(@ActionDesc AS varchar(max)) AS varchar(1000)), @DateTime)
        """;

    public Task LogInsertAsync<T>(string tableName, T entity, IDbTransaction? tx = null) where T : class
        => WriteAsync(BuildInsert(tableName, entity), tx);

    /// <summary>Writes nothing when no property changed.</summary>
    public Task LogUpdateAsync<T>(string tableName, T before, T after, IDbTransaction? tx = null) where T : class
    {
        var audit = BuildUpdate(tableName, before, after);
        return audit.ActionDesc == string.Empty ? Task.CompletedTask : WriteAsync(audit, tx);
    }

    public Task LogDeleteAsync<T>(string tableName, T entity, IDbTransaction? tx = null) where T : class
        => WriteAsync(BuildDelete(tableName, entity), tx);

    public RowAudit BuildInsert<T>(string tableName, T entity) where T : class
        => Build(tableName, "Insert", entity, FirstStringValue(entity));

    public RowAudit BuildDelete<T>(string tableName, T entity) where T : class
        => Build(tableName, "Delete", entity, FirstStringValue(entity));

    /// <summary>
    /// ActionDesc = names of the properties whose values differ, in declaration order; empty when none.
    /// Scalars compare by value; n-n lists (e.g. Course.Certifications) compare their items' scalar values,
    /// ignoring order. Nav objects and <see cref="RowAuditIgnoreAttribute"/> properties are skipped.
    /// </summary>
    public RowAudit BuildUpdate<T>(string tableName, T before, T after) where T : class
    {
        var changed = Properties(typeof(T))
            .Where(p => p.GetCustomAttribute<RowAuditIgnoreAttribute>() is null)
            .Where(p => IsScalarType(p.PropertyType)
                ? !Equals(p.GetValue(before), p.GetValue(after))
                : IsCollection(p.PropertyType) && !SameItems(p.GetValue(before), p.GetValue(after)))
            .Select(p => p.Name);
        return Build(tableName, "Update", after, string.Join(",", changed));
    }

    private RowAudit Build(string tableName, string actionType, object entity, string? actionDesc) => new()
    {
        TableName = tableName,
        UserName = CurrentUserName(),
        PrimaryKeyValues = PrimaryKeyValue(entity),
        ActionType = actionType,
        ActionDesc = actionDesc is { Length: > MaxActionDescLength } ? actionDesc[..MaxActionDescLength] : actionDesc,
        DateTime = clock.GetUtcNow().UtcDateTime,
    };

    private async Task WriteAsync(RowAudit audit, IDbTransaction? tx)
    {
        if (tx is not null)
        {
            await tx.Connection!.ExecuteAsync(InsertSql, audit, tx);
            return;
        }

        using var conn = await db.CreateOpenConnectionAsync();
        await conn.ExecuteAsync(InsertSql, audit);
    }

    /// <summary>The JWT `name` claim (Lab 05: AppUser.UserName); "system" when nobody is signed in.</summary>
    private string CurrentUserName()
    {
        var user = http.HttpContext?.User;
        if (user?.Identity?.IsAuthenticated != true) return SystemUser;

        var name = user.FindFirstValue(AccessTokenBuilder.UserNameClaim) ?? user.FindFirstValue(ClaimTypes.Name);
        return string.IsNullOrWhiteSpace(name) ? SystemUser : name;
    }

    private static string PrimaryKeyValue(object entity)
    {
        var pkid = entity.GetType().GetProperty("Pkid", BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase)
            ?? throw new InvalidOperationException($"{entity.GetType().Name} has no pkid property to audit.");
        return Convert.ToString(pkid.GetValue(entity), CultureInfo.InvariantCulture) ?? string.Empty;
    }

    private static string? FirstStringValue(object entity)
        => (string?)Properties(entity.GetType()).FirstOrDefault(p => p.PropertyType == typeof(string))?.GetValue(entity);

    private static bool IsScalarType(Type t) => IsScalar(Nullable.GetUnderlyingType(t) ?? t);

    private static bool IsCollection(Type t) => t != typeof(string) && typeof(System.Collections.IEnumerable).IsAssignableFrom(t);

    // Multiset compare of item signatures, so reloading the same relations in another order is not a change.
    private static bool SameItems(object? before, object? after)
    {
        static List<string> Signatures(object? items) => items is System.Collections.IEnumerable e
            ? e.Cast<object?>().Select(Signature).Order(StringComparer.Ordinal).ToList()
            : [];
        return Signatures(before).SequenceEqual(Signatures(after));
    }

    private static string Signature(object? item) => item is null || IsScalarType(item.GetType())
        ? Convert.ToString(item, CultureInfo.InvariantCulture) ?? string.Empty
        : string.Join("\u001F", Properties(item.GetType())
            .Where(p => IsScalarType(p.PropertyType))
            .Select(p => Convert.ToString(p.GetValue(item), CultureInfo.InvariantCulture)));

    // GetProperties() returns declaration order for our flat POCOs.
    private static IEnumerable<PropertyInfo> Properties(Type type)
        => type.GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Where(p => p.CanRead && p.GetIndexParameters().Length == 0);

    private static bool IsScalar(Type t)
        => t.IsPrimitive || t.IsEnum || t == typeof(string) || t == typeof(decimal) || t == typeof(DateTime)
            || t == typeof(DateTimeOffset) || t == typeof(DateOnly) || t == typeof(TimeOnly) || t == typeof(TimeSpan)
            || t == typeof(Guid);
}

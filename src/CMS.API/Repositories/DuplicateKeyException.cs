namespace CMS.API.Repositories;

/// <summary>Thrown when an insert/update violates a UNIQUE constraint (SQL error 2627 / 2601).</summary>
public class DuplicateKeyException(string message) : Exception(message);

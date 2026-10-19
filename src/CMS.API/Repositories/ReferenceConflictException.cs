namespace CMS.API.Repositories;

/// <summary>Thrown when a delete is blocked by a FOREIGN KEY reference (SQL error 547).</summary>
public class ReferenceConflictException(string message) : Exception(message);

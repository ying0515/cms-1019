namespace CMS.API.Repositories;

/// <summary>Thrown when an insert/update points a FOREIGN KEY at a row that does not exist (SQL error 547).</summary>
public class InvalidReferenceException(string message) : Exception(message);

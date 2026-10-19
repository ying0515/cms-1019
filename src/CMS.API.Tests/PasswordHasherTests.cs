using CMS.API.Data;

namespace CMS.API.Tests;

public class PasswordHasherTests
{
    [Theory]
    [InlineData("", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")]
    [InlineData("abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")]
    public void Sha256Hex_MatchesKnownVectors(string input, string expected)
    {
        Assert.Equal(expected, PasswordHasher.Sha256Hex(input));
    }
}

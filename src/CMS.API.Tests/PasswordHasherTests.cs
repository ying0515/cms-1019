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

    [Fact]
    public void Hash_IsSalted_AndVerifies()
    {
        var first = PasswordHasher.Hash("S3cret-pass");
        var second = PasswordHasher.Hash("S3cret-pass");

        Assert.NotEqual(first, second);
        Assert.Equal(PasswordCheck.Success, PasswordHasher.Verify(first, "S3cret-pass"));
        Assert.Equal(PasswordCheck.Failed, PasswordHasher.Verify(first, "s3cret-pass"));
    }

    [Fact]
    public void Verify_LegacySha256_SucceedsWithRehashNeeded()
    {
        var legacy = PasswordHasher.Sha256Hex("abc");

        Assert.Equal(PasswordCheck.SuccessRehashNeeded, PasswordHasher.Verify(legacy, "abc"));
        Assert.Equal(PasswordCheck.SuccessRehashNeeded, PasswordHasher.Verify(legacy.ToUpperInvariant(), "abc"));
        Assert.Equal(PasswordCheck.Failed, PasswordHasher.Verify(legacy, "abd"));
    }

    [Theory]
    [InlineData("")]
    [InlineData("seed-hash")]
    [InlineData("AQAAAAE=")]
    public void Verify_UnrecognizedHash_Fails(string storedHash)
    {
        Assert.Equal(PasswordCheck.Failed, PasswordHasher.Verify(storedHash, "anything"));
    }
}

using System.Net;
using System.Net.Http.Json;
using CMS.API.Data;
using CMS.API.Models;
using CMS.API.Tests.Infrastructure;

namespace CMS.API.Tests;

/// <summary>POST /api/auth/change-password for the JWT user (helen, pkid 1, via the CmsApiFactory default token).</summary>
public class AuthChangePasswordTests : IDisposable
{
    private const string Url = "/api/auth/change-password";
    private const string Current = "Old#Pass1";
    private const string NewPassword = "N3w-Secret!";

    private readonly CmsApiFactory _factory = new();
    private readonly HttpClient _client;

    public AuthChangePasswordTests()
    {
        _client = _factory.CreateClient();
        _factory.AppUsers.SetPassword("helen", Current);
        _factory.AppUsers.SetPassword("jenny", Current);
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    private Task<HttpResponseMessage> Change(string current, string next, string? confirm = null)
        => _client.PostAsJsonAsync(Url, new ChangePasswordRequest
        {
            CurrentPassword = current,
            NewPassword = next,
            ConfirmPassword = confirm ?? next,
        });

    private async Task<DateTime?> HelenPasswordUpdatedTime()
        => (await _factory.AppUsers.GetByIdAsync(1))!.PasswordUpdatedTime;

    private async Task AssertMessage(HttpResponseMessage res, string expected)
    {
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Equal(expected, body!["message"]);
    }

    // ---- Success ----

    [Fact]
    public async Task Valid_SetsHashToSha256OfNew_AndPasswordUpdatedTimeToNow()
    {
        var res = await Change(Current, NewPassword);

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);
        Assert.Equal(PasswordHasher.Sha256Hex(NewPassword), _factory.AppUsers.PasswordHashOf(1));
        Assert.Equal(_factory.Clock.Now.UtcDateTime, await HelenPasswordUpdatedTime());
        Assert.Equal(string.Empty, await res.Content.ReadAsStringAsync()); // nothing (no hash) comes back
    }

    [Fact]
    public async Task Valid_OnlyChangesTheJwtUser_AndLoginUsesTheNewPassword()
    {
        await Change(Current, NewPassword);

        Assert.Equal(PasswordHasher.Sha256Hex(Current), _factory.AppUsers.PasswordHashOf(2)); // jenny
        var withNew = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest { UserId = "helen", Password = NewPassword });
        var withOld = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest { UserId = "helen", Password = Current });
        Assert.Equal(HttpStatusCode.OK, withNew.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, withOld.StatusCode);
    }

    // ---- Wrong current password ----

    [Fact]
    public async Task WrongCurrentPassword_Returns400_AndChangesNothing()
    {
        var timeBefore = await HelenPasswordUpdatedTime();

        var res = await Change("not-my-password", NewPassword);

        // 400, not 401: a 401 would make the frontend sign the user out
        await AssertMessage(res, "目前密碼不正確");
        Assert.Equal(PasswordHasher.Sha256Hex(Current), _factory.AppUsers.PasswordHashOf(1));
        Assert.Equal(timeBefore, await HelenPasswordUpdatedTime());
    }

    [Fact]
    public async Task WrongCurrentPassword_IsReportedBeforeAWeakNewPassword()
    {
        await AssertMessage(await Change("not-my-password", "weak"), "目前密碼不正確");
    }

    // ---- Complexity ----

    [Theory]
    [InlineData("Ab1!xyz")]     // 7 chars, all 4 classes
    [InlineData("abcdefgh")]    // lowercase only
    [InlineData("abcd1234")]    // 2 classes: lower + digit
    [InlineData("ABCDabcd")]    // 2 classes: upper + lower
    [InlineData("abcd!@#$")]    // 2 classes: lower + symbol
    [InlineData("12345678")]    // digit only
    [InlineData("abc  123")]    // whitespace is not a symbol → 2 classes
    public async Task WeakNewPassword_Returns400WithPolicyMessage_AndChangesNothing(string weak)
    {
        var timeBefore = await HelenPasswordUpdatedTime();

        await AssertMessage(await Change(Current, weak), PasswordPolicy.Message);
        Assert.Equal(PasswordHasher.Sha256Hex(Current), _factory.AppUsers.PasswordHashOf(1));
        Assert.Equal(timeBefore, await HelenPasswordUpdatedTime());
    }

    [Fact]
    public void PolicyMessage_IsBilingual()
    {
        Assert.StartsWith("密碼長度至少需 8 碼，且內容須至少包含四種字元的其中三種：大寫英文／小寫英文／數字／符號", PasswordPolicy.Message);
        Assert.Contains("Password must be at least 8 characters and contain at least 3 of the 4 classes", PasswordPolicy.Message);
    }

    // ---- Confirm ----

    [Fact]
    public async Task ConfirmMismatch_Returns400_AndChangesNothing()
    {
        await AssertMessage(await Change(Current, NewPassword, NewPassword + "x"), "新密碼與確認密碼不一致");
        Assert.Equal(PasswordHasher.Sha256Hex(Current), _factory.AppUsers.PasswordHashOf(1));
    }

    // ---- Request shape / auth ----

    [Theory]
    [InlineData("", NewPassword, NewPassword, "請輸入目前密碼")]
    [InlineData(Current, "", "", "請輸入新密碼")]
    [InlineData(Current, NewPassword, "", "請再次輸入新密碼")]
    public async Task MissingField_Returns400(string current, string next, string confirm, string message)
    {
        var res = await Change(current, next, confirm);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains(message, await res.Content.ReadAsStringAsync());
        Assert.Equal(PasswordHasher.Sha256Hex(Current), _factory.AppUsers.PasswordHashOf(1));
    }

    [Fact]
    public async Task WithoutToken_Returns401()
    {
        _client.DefaultRequestHeaders.Authorization = null;

        Assert.Equal(HttpStatusCode.Unauthorized, (await Change(Current, NewPassword)).StatusCode);
        Assert.Equal(PasswordHasher.Sha256Hex(Current), _factory.AppUsers.PasswordHashOf(1));
    }
}

public class PasswordPolicyTests
{
    [Theory]
    [InlineData("Abcdefg1", true)]   // upper + lower + digit
    [InlineData("abcdef1!", true)]   // lower + digit + symbol
    [InlineData("ABCDEF1!", true)]   // upper + digit + symbol
    [InlineData("Abcdefg!", true)]   // upper + lower + symbol
    [InlineData("Ab1!Ab1!", true)]   // all 4
    [InlineData("密碼abc123", true)] // 8 chars: lower + digit + CJK (counts as a symbol)
    [InlineData("Abcdefgh", false)]  // 2 classes
    [InlineData("Ab1!", false)]      // too short
    [InlineData("", false)]
    public void IsValid(string password, bool expected)
    {
        Assert.Equal(expected, PasswordPolicy.IsValid(password));
    }
}

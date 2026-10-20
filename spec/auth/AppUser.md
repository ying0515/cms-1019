# Build Spec for AppUser
- database schema: .\database\auth.sql

## Summary

`AppUser` holds back-office login accounts. Each user has a unique `UserId` (the table PK, referenced by `AppUserRole`), a display name, an active flag and a password hash. Roles are assigned n-n through `AppUserRole`. `pkid` is an `int IDENTITY` surrogate used for routing (same pattern as `AppRole`).

**`PasswordHash` is backend-only**: it never appears in any request, response or Angular model. It is set on create from the system default password and changed only by the Admin-only `POST /api/auth/reset-password` (to the default) and the user's own `POST /api/auth/change-password` (both on `AuthController`).

| Item | Detail |
|------|--------|
| Primary Key | `UserId` nvarchar(200) (table PK, immutable after create); `pkid` int IDENTITY used in routes |
| Foreign Keys | None |
| Required Fields | `UserId`, `UserName`, `IsActive` (`PasswordHash` is required in DB but set by the backend) |
| N-N Relationships | `AppUserRole` (UserId ↔ RoleId) → `AppRole` |
| Primary-Foreign Links | `AppUserRole.UserId` → 查看角色 `/app-roles?userId={userId}` |
| Query Filters | keyword (UserId, UserName), IsActive, RoleId |
| Default Sort | `u.UserId ASC` |

---

## Localization

### Chinese Table Name

- AppUser: 使用者
- Description: 後台登入帳號與其角色指派

### Chinese Column Names

- pkid: 主代碼
- UserId: 使用者帳號
- UserName: 使用者名稱
- IsActive: 啟用
- PasswordHash: 密碼雜湊 (backend only — never displayed)
- PasswordUpdatedTime: 密碼更新時間
- Roles (n-n): 角色

---

## Required Fields

Required (NOT NULL):
- `UserId` (max 200, unique, immutable after create)
- `UserName` (max 200)
- `IsActive` (DB default 1 → form defaults to checked)
- `PasswordHash` — **not user input**; set by the backend (see Password Handling)

Optional (nullable):
- `PasswordUpdatedTime` — set by the backend, read-only in the UI

---

## Foreign Keys

N/A

---

## Foreign-Primary Links

N/A

---

## Primary-Foreign Links

- **AppUserRole** (`UserId`) — column header 角色數, button 查看角色 (`pi pi-id-card`), target `/app-roles?userId={userId}`.
  The AppRole list does not read query params yet: add `userId` handling (incoming param replaces saved filters and resets to page 1, same as Course's FK params).

Deleting a user deletes its `AppUserRole` rows first (same transaction), so delete never returns 409.

---

## N-N Relationships

- Junction `AppUserRole (UserId, RoleId)` → `AppRole`
- Lookup: `GET /api/lookups/app-roles` (**new**) → `{ roleId, roleName }[]` ordered by `RoleId ASC`
- **List**: `RoleCount` subquery column
- **Detail**: roles shown as tags `RoleName (RoleId)`
- **Form**: `p-multiselect` (`[maxSelectedLabels]="9999"`, chip display, filter)
- Request field: `RoleIds: List<string>`
- Sync on create/update (one transaction):
  1. `DELETE FROM AppUserRole WHERE UserId = @UserId`
  2. bulk `INSERT INTO AppUserRole (UserId, RoleId) VALUES (@UserId, @RoleId)`
- Unknown RoleId → SQL 547 → `InvalidReferenceException` → 400.

---

## Query Filters

- **keyword**: LIKE on `UserId`, `UserName`
- **IsActive**: bool? tri-state (全部 / 是 / 否)
- **RoleId**: string? — `EXISTS (SELECT 1 FROM AppUserRole ur WHERE ur.UserId = u.UserId AND ur.RoleId = @RoleId)`; dropdown from `/api/lookups/app-roles`, label `RoleName (RoleId)`
- No date-range filter on `PasswordUpdatedTime` (stored UTC; low value as a filter).

---

## Lookup Endpoints Required

| Route | Status | Returns |
|-------|--------|---------|
| `GET /api/lookups/app-roles` | New | `{ roleId, roleName }[]` ordered by `RoleId ASC` |
| `GET /api/lookups/app-users` | Exists | Used by AppRole; unchanged |

---

## API Endpoints

| Method | Route | Notes |
|--------|-------|-------|
| `GET` | `/api/app-users` | List all |
| `POST` | `/api/app-users/query` | Filtered query (body: `AppUserQuery`) |
| `GET` | `/api/app-users/{id:int}` | Get by pkid (includes `roles`) |
| `POST` | `/api/app-users` | Create — **409** if UserId exists; **500** if default password not configured; sets PasswordHash + PasswordUpdatedTime |
| `PUT` | `/api/app-users` | Update (pkid from body); UserId and PasswordHash are not changed |
| `DELETE` | `/api/app-users/{id:int}` | Delete (removes AppUserRole rows first) |
| `POST` | `/api/auth/reset-password` (on `AuthController`) | **Admin only** (`[Authorize(Roles = "Admin")]`, else 403). Body `{ userId }`. Resets PasswordHash to SHA-256 of the current default password, sets PasswordUpdatedTime; 204 (no body) / 400 / 404 / 500 if not configured. Replaces the former `/api/app-users/{id}/reset-password`. |

---

## Password Handling (backend only)

- Default password source: `SELECT configValue FROM SysConfig WHERE configKey = 'appConfig'`; value is JSON, read string property `defaultPassword`.
- Hash: `SHA256(UTF-8 bytes)` → lowercase hex (64 chars) → `PasswordHash`.
- Missing row / invalid JSON / missing or empty `defaultPassword` → controller returns 500 `{ message: "系統設定 appConfig 未設定 defaultPassword" }`; nothing is written.
- `PasswordUpdatedTime` = UTC now on create (`GETUTCDATE()`) and on reset / change password (injected `TimeProvider`) (UTC, so the UI appends `'Z'`).
- New `ISysConfigRepository.GetValueAsync(configKey)` (Dapper) + static `PasswordHasher.Sha256Hex` in `Data/`. The controller resolves the hash and passes it to `CreateAsync(request, passwordHash)` / `ResetPasswordAsync(pkid, passwordHash)`.

---

## Backend Notes

### Models

```csharp
public class AppUser
{
    public int Pkid { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime? PasswordUpdatedTime { get; set; }
    public int RoleCount { get; set; }
    public List<AppRoleLookup> Roles { get; set; } = []; // GET by pkid only
}

public class AppUserRequest
{
    public int Pkid { get; set; }
    [Required, StringLength(200)] public string UserId { get; set; } = string.Empty;
    [Required, StringLength(200)] public string UserName { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public List<string> RoleIds { get; set; } = [];
}

public class AppUserQuery
{
    public string? Keyword { get; set; }
    public bool? IsActive { get; set; }
    public string? RoleId { get; set; }
}

public class AppRoleLookup
{
    public string RoleId { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
}
```

### SQL — SELECT

```sql
SELECT u.pkid, u.UserId, u.UserName, u.IsActive, u.PasswordUpdatedTime,
       (SELECT COUNT(*) FROM AppUserRole ur WHERE ur.UserId = u.UserId) AS RoleCount
FROM AppUser u
ORDER BY u.UserId ASC
```
`PasswordHash` is never selected. Roles for GET by pkid: separate query on the same connection joining `AppUserRole` → `AppRole`, ordered by `RoleId`.

### SQL — INSERT

```sql
INSERT INTO AppUser (UserId, UserName, IsActive, PasswordHash, PasswordUpdatedTime)
VALUES (@UserId, @UserName, @IsActive, @PasswordHash, GETUTCDATE());
SELECT CAST(SCOPE_IDENTITY() AS int);
```

### SQL — UPDATE

```sql
UPDATE AppUser SET UserName = @UserName, IsActive = @IsActive WHERE pkid = @Pkid
```

### SQL — RESET PASSWORD

```sql
UPDATE AppUser SET PasswordHash = @PasswordHash, PasswordUpdatedTime = GETUTCDATE() WHERE pkid = @pkid
```

### SQL — DELETE

Transaction: look up UserId by pkid → `DELETE FROM AppUserRole WHERE UserId = @userId` → `DELETE FROM AppUser WHERE pkid = @pkid`.

### Special Column Notes

- `UserId`, `UserName` trimmed on create/update.
- No `nchar`, date/time or computed columns. RowAudit: no `RowAuditWriter` exists yet — skipped.

---

## Frontend Notes

### Routes

| Path | Component | Title |
|------|-----------|-------|
| `/app-users` | `AppUserList` | 使用者 AppUser |
| `/app-users/new` | `AppUserForm` | 新增使用者 |
| `/app-users/:id` | `AppUserDetail` | 檢視使用者 |
| `/app-users/:id/edit` | `AppUserForm` | 編輯使用者 |

### Model (`core/models/app-user.model.ts`)

```ts
export interface AppUser { pkid: number; userId: string; userName: string; isActive: boolean; passwordUpdatedTime: string | null; roleCount: number; roles: AppRoleLookup[]; }
export interface AppUserRequest { pkid: number; userId: string; userName: string; isActive: boolean; roleIds: string[]; }
export interface AppUserQuery { keyword?: string | null; isActive?: boolean | null; roleId?: string | null; }
```
No password field anywhere. `AppRoleLookup { roleId; roleName }` added to `lookup.model.ts`.

### List

- Columns: 主代碼, 使用者帳號 (link to detail), 使用者名稱, 啟用 (check/dash icon), 密碼更新時間 (`+ 'Z' | date:'yyyy-MM-dd HH:mm'`), 角色數, 操作 (查看角色 / view / edit / delete).
- Default sort `userId` ASC.
- Filter drawer: 關鍵字 (placeholder 使用者帳號、使用者名稱); 啟用 `p-select` 全部/是/否; 角色 `p-select` from app-roles lookup. All `appendTo="body"`.

### Detail

- Card: 主代碼, 使用者帳號, 使用者名稱, 啟用 tag, 密碼更新時間, 角色 tags.
- Toolbar: 返回, 查看角色, 重設密碼 (confirm `確定要將使用者 <b>{userId}</b> 的密碼重設為系統預設密碼？`), 編輯, 刪除.

### Form

- `userId`: `pInputText`, required, maxlength 200, **disabled in edit mode**.
- `userName`: `pInputText`, required, maxlength 200.
- `isActive`: `p-checkbox` binary, default true.
- `roleIds`: `p-multiselect` of roles.
- No password field. New mode shows hint: 新使用者將使用系統預設密碼.
- Sticky `p-toolbar` 取消 / 儲存. 409 → `使用者帳號「{userId}」已存在`.

### Delete Confirmation

```
確定要刪除主代碼 <b>${item.pkid}</b>「${escapeHtml(item.userName)}」？
```

### Session Storage Keys

| Key | Contents |
|-----|----------|
| `app-user-list-filters` | Last query filter values |
| `app-user-list-sort` | `{ sortField, sortOrder }` |
| `app-user-list-page` | `{ first, rows }` |

### Sidebar

Existing group **系統管理 Admin** → `使用者 AppUser` (`pi pi-user`, `/app-users`), placed first.

---

## Tests

### Backend (`CMS.API.Tests`)

- `Infrastructure/FakeAppUserRepository.cs` (seed helen / jenny / miles, exposes stored hashes), `FakeSysConfigRepository.cs` (settable `appConfig`), register both in `CmsApiFactory`; `FakeLookupRepository` gains `GetAppRolesAsync`.
- `AppUsersControllerTests.cs`: GetAll sorted; query by keyword / IsActive / RoleId; get found (with roles, no `passwordHash` property in JSON) / 404; create 201 + hash = SHA-256(defaultPassword) + PasswordUpdatedTime set / duplicate 409 / missing UserName 400 / `passwordHash` in body ignored / appConfig missing 500; update 204 keeps hash / 404 / 400; delete 204 / 404; `GET /api/lookups/app-roles`.
- `AuthResetPasswordTests.cs`: Admin reset → hash = SHA-256(SysConfig defaultPassword, read at call time) + PasswordUpdatedTime = clock, empty 204 body; non-Admin 403 (also before body validation); no token 401; unknown user 404; defaultPassword missing 500; old `/api/app-users/{id}/reset-password` gone.
- `PasswordHasherTests.cs`: known SHA-256 vector.

### Frontend

- `app-user.service.spec.ts` (resetPassword posts only `{ userId }` to `/api/auth/reset-password`); `app-user-form.spec.ts` / `app-user-detail.spec.ts`: reset button only for Admins (form: edit mode only), confirm first, `lookup.service.spec.ts` (getAppRoles)
- `app-user-list.spec.ts`, `app-user-detail.spec.ts`, `app-user-form.spec.ts`; `app-role-list.spec.ts` gains `?userId=` case

---

## Files to Create / Modify

| Area | File | Action |
|------|------|--------|
| API | `Models/AppUser.cs`, `AppUserRequest.cs`, `AppUserQuery.cs`, `AppRoleLookup.cs` | Create |
| API | `Repositories/IAppUserRepository.cs`, `AppUserRepository.cs`, `ISysConfigRepository.cs`, `SysConfigRepository.cs`; `Data/PasswordHasher.cs` | Create |
| API | `Controllers/AppUsersController.cs` | Create |
| API | `Repositories/ILookupRepository.cs`, `LookupRepository.cs`, `Controllers/LookupsController.cs`, `Program.cs` | Modify |
| Tests | `AppUsersControllerTests.cs`, `PasswordHasherTests.cs`, `Infrastructure/FakeAppUserRepository.cs`, `FakeSysConfigRepository.cs` | Create |
| Tests | `Infrastructure/CmsApiFactory.cs`, `FakeLookupRepository.cs`, `FakeAppRoleRepository.cs` | Modify |
| NG | `core/models/app-user.model.ts`, `core/services/app-user.service.ts` (+ spec) | Create |
| NG | `core/models/lookup.model.ts`, `core/services/lookup.service.ts` (+ spec) | Modify |
| NG | `features/app-users/app-user-{list,detail,form}/*` (+ specs), `testing/app-user.fixtures.ts` | Create |
| NG | `features/app-roles/app-role-list/app-role-list.ts` (+ spec) — accept `?userId=` | Modify |
| NG | `app.routes.ts`, `app.ts` | Modify |

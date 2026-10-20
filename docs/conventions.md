# Code conventions

Project rules for API and Angular code. Scaffolding patterns per table: `spec/code-gen.convention.md`.

## Cross-cutting checklist (every feature)

Every new repository and every detail / form page passes all of these.

**Row audit**: each Insert / Update / Delete writes one `RowAudit` row.
- [ ] Repository injects `RowAuditWriter`. Every write method runs on one connection + `tx`. It loads rows with a private `LoadAsync(conn, tx, pkid)`, the same full load `GetByIdAsync` uses (n-n lists included).
  - Insert: INSERT → `LogInsertAsync(TableName, LoadAsync(pkid))`.
  - Update: `before = LoadAsync` (missing → `false`) → UPDATE → `LogUpdateAsync(before, LoadAsync)`.
  - Delete: `before = LoadAsync` → DELETE → `LogDeleteAsync(before)`.
- [ ] Order: the audit is the last step before `tx.Commit()`, so a failed change leaves no audit row. FK-blocked delete messages take the name from `before`, because a query outside the open `tx` throws.
- [ ] `TableName` = a const holding the real DB table name. The model's first string property is the record's display name. Non-column properties (subquery counts) get `[RowAuditIgnore]`.
- What the writer records by itself:
  - PrimaryKeyValues = pkid as a string. UserName = JWT `name`, else `system`. RowAudit's own pkid is IDENTITY.
  - ActionDesc: on Insert / Delete, the first string value. On Update, the changed property names, comma-separated; n-n lists count by property name (e.g. `Roles`); no row when nothing changed.
- [ ] Detail and form pages wrap the title in `<div class="start">` (global style in `styles.scss`), followed by `<app-row-audit-badge tableName="{DB table}" [pkid]="..." />`. On a detail page it goes inside `@if (item(); as audited)`; on a form inside `@if (isEdit)`, since a new record has no history. The badge shows the latest change and opens the full trail (`GET /api/rowaudit?tableName=&pkid=`).
- [ ] Tests:
  - Page specs add `provideRowAuditStub()` from `@core/testing/row-audit` and check the badge's table name and pkid with `rowAuditStub()`.
  - Repository audit paths: `RowAuditRepositoryTests` (`[Trait("Category", "Database")]`) runs real repositories against the local DB and deletes what it creates.

**Errors**: one safe 500 from the API, one toast in the UI.
- [ ] Controllers catch only business exceptions they map to 400 / 404 / 409, and let everything else propagate.
  - `Middleware/ExceptionHandlingMiddleware.cs` (after CORS, before authentication) logs the full exception with a traceId. It returns 500 `{ message, traceId }` with the generic bilingual `SafeMessage`, never the exception text.
  - 401 / 403 / validation 400 stay as the framework returns them.
  - Tests: `ExceptionHandlingTests` swaps in a throwing repository with `WithWebHostBuilder` + `ConfigureTestServices`.
- [ ] Angular page error toasts use `showHttpError(this.messages, '儲存失敗', err)`, which skips 5xx. `authInterceptor` owns the 5xx toast (系統錯誤 Server error + the API's safe message) and the 401 → Login redirect. Inline form errors use `httpErrorMessage()`.

## Backend (`src/CMS.API`)

- Dapper only. Per table: `{T}`, `{T}Request`, `{T}Query`, `I{T}Repository` + impl, controller `/api/{plural}`: `GET /`, `POST /query`, `GET /{id}`, `POST /`, `PUT /` (pkid in body), `DELETE /{id}`. Lookups go in `LookupsController` / `LookupRepository`.
- Register repos in `Program.cs`; swap in fakes in `CmsApiFactory` for tests (`src/CMS.API.Tests/Infrastructure/Fake*`).
- `RTRIM()` nchar columns; `date`/`time` → `DateOnly`/`TimeOnly`. n-n: delete-then-reinsert in one transaction.
- FK errors (SQL 547): delete blocked → `ReferenceConflictException` → 409; bad FK on write → `InvalidReferenceException` → 400.
- Backend-only columns (e.g. `AppUser.PasswordHash`): never in `{T}Request`, response models or SELECTs.
- Upsert on a natural key (idempotent resubmits): one `MERGE {T} WITH (HOLDLOCK) AS t USING (SELECT @Key1 AS Key1, ...) AS s ON t.Key1 = s.Key1 AND ... WHEN MATCHED THEN UPDATE SET ... WHEN NOT MATCHED THEN INSERT ...;` per row, all rows in one transaction (`conn.ExecuteAsync(sql, rows, tx)`). `HOLDLOCK` stops two concurrent callers from both inserting. Set absolute values (never `+=`) and leave rows missing from the payload untouched. Reject duplicate keys within one payload (400) before calling the repository. Example: `AgentTokenUsageRepository.UpsertAsync`.
- Per-action API key: an `IAuthorizationFilter` applied with a `TypeFilterAttribute` (`[RequireAgentApiKey]`), so 401 comes before `[ApiController]` model-validation 400; compare with `CryptographicOperations.FixedTimeEquals`. Tests set the key with `builder.UseSetting` in `CmsApiFactory`.
- Domain rule inside a repository transaction: keep the rule a pure static function (e.g. `CostCalculator.Cost`) and pass it to the repository as a delegate (`CostFunction`); the repository only reads, calls the delegate, and writes, all on one `tx`. Fakes call the same delegate instead of reimplementing the rule, so HTTP tests exercise the real rule. Example: `ModelPriceRepository` re-pricing `AgentTokenUsage`.
- "Now" comes from an injected `TimeProvider` (registered as `TimeProvider.System`); tests swap in `FixedTimeProvider` (`CmsApiFactory.Clock`).
- Auth: every endpoint needs a JWT (`MapControllers().RequireAuthorization()` in `Program.cs`); opt out only with `[AllowAnonymous]` (login, API-key endpoints). Tests: `CmsApiFactory` clients send a valid token for helen/Admin; to test 401, clear `DefaultRequestHeaders.Authorization`. The token signing key lives inside SysConfig `appConfig`, so a test that replaces that JSON must keep `symmetricSecurityKey` or the request 401s before reaching the controller. Business errors on signed-in endpoints (e.g. wrong current password) are 400, never 401: the Angular interceptor treats every 401 as an expired session and signs the user out. Role-restricted actions: `[Authorize(Roles = "Admin")]` (JwtBearer maps the token's `role` claim to `ClaimTypes.Role`); non-members get 403 before model validation. Hiding a button is never the check; test with `CmsApiFactory.TokenFor(userId, userName, roles...)`.

## Frontend (`src/CMS.NG`)

- Standalone components, `inject()`, signals; lazy routes in `app.routes.ts` (`/new` before `/:id`); sidebar in `app.ts` `navGroups`; aliases `@core/*`, `@env/*`.
- List state: `session-state.util.ts` (`{table}-list-filters|sort|page`).
- Auth: `core/auth/` (`AuthService`, `authInterceptor`, `authGuard`). New pages go inside `appRoutes` (guarded); only `/login` is outside. Hide a nav group per role with `role` on `NavGroup`. Logout / 401 call `sessionStorage.clear()`, which also drops saved list state. Specs that render the shell call `signInForTest(roles)` from `@core/testing/auth` first.
- Form pages: header toolbar is `<div class="page-header form-toolbar" data-testid="form-toolbar">` (pinned via the global rule in `styles.scss`); spec with `expectPinnedToolbar()` from `@core/testing/form-toolbar` in add and edit mode.
- Delete confirm: `確定要刪除主代碼 <b>{pkid}</b>「{name}」？` (escape name).
- Dates: local components, never `toISOString().split('T')[0]` (helpers in `core/utils/date.util.ts`); append `'Z'` to API datetimes before parsing.
- Prettier: width 100, single quotes. Run it only on files you create — existing files aren't Prettier-clean, so formatting them adds unrelated diff noise.

# Code conventions

Project rules for API and Angular code. Scaffolding patterns per table: `spec/code-gen.convention.md`.

## Backend (`src/CMS.API`)

- Dapper only. Per table: `{T}`, `{T}Request`, `{T}Query`, `I{T}Repository` + impl, controller `/api/{plural}`: `GET /`, `POST /query`, `GET /{id}`, `POST /`, `PUT /` (pkid in body), `DELETE /{id}`. Lookups go in `LookupsController` / `LookupRepository`.
- Register repos in `Program.cs`; swap in fakes in `CmsApiFactory` for tests (`src/CMS.API.Tests/Infrastructure/Fake*`).
- `RTRIM()` nchar columns; `date`/`time` → `DateOnly`/`TimeOnly`. n-n: delete-then-reinsert in one transaction.
- FK errors (SQL 547): delete blocked → `ReferenceConflictException` → 409; bad FK on write → `InvalidReferenceException` → 400.
- Backend-only columns (e.g. `AppUser.PasswordHash`): never in `{T}Request`, response models or SELECTs. Login reads them through `AppUserCredential`, which no endpoint returns.
- Auth: every endpoint requires sign-in by default (fallback policy in `Auth/CmsAuth.cs`); don't add `[Authorize]`. Only `AuthController` opts out (`[AllowAnonymous]`, or `CmsAuth.SignedInPolicy` for pages a must-change-password user may reach). Passwords: `PasswordHasher.Hash` / `Verify` (PBKDF2; legacy SHA-256 verifies with rehash). Tests: `CreateClient()` is signed in as `helen` via the `X-Test-User` header (`TestAuthHandler`); `CreateAnonymousClient()` uses the real cookie login.

## Frontend (`src/CMS.NG`)

- Standalone components, `inject()`, signals; lazy routes in `app.routes.ts` (`/new` before `/:id`); sidebar in `app.ts` `navGroups`; aliases `@core/*`, `@env/*`.
- Auth: new back-office routes go in `backOfficeRoutes` (`app.routes.ts`), which `authGuard` covers. API calls must use `environment.apiUrl` so `authInterceptor` adds `withCredentials` (the session cookie) and sends a 401 to `/login`. Redirect targets from query params go through `safeReturnUrl()`.
- List state: `session-state.util.ts` (`{table}-list-filters|sort|page`). Errors: `httpErrorMessage()`.
- Form pages: header toolbar is `<div class="page-header form-toolbar" data-testid="form-toolbar">` (pinned via the global rule in `styles.scss`); spec with `expectPinnedToolbar()` from `@core/testing/form-toolbar` in add and edit mode.
- Delete confirm: `確定要刪除主代碼 <b>{pkid}</b>「{name}」？` (escape name).
- Dates: local components, never `toISOString().split('T')[0]` (helpers in `core/utils/date.util.ts`); append `'Z'` to API datetimes before parsing.
- Prettier: width 100, single quotes. Run it only on files you create — existing files aren't Prettier-clean, so formatting them adds unrelated diff noise.

## Print

- `.print-only` shows only on paper, `.screen-only` only on screen (`styles.scss`). Page: A4, 15mm margins, page number `n / N` at the bottom (`@page`). The `@page` margin boxes also stop Chrome/Edge from printing their own header and footer (date, title, CMS URL); keep them if you change `@page`.
- Hidden on every page when printing: `p-button`, `p-toast`, `p-confirmdialog`, `.p-tooltip`, `.screen-only` (`styles.scss`); `.sidebar`, plus the shell padding and min-height reset (`app.scss`, `!important` at EOF). Other PrimeNG widgets (`[pButton]`, dialogs, paginator) still print.
- Preview without the dialog: DevTools → ⋮ → More tools → Rendering → 「Emulate CSS media type: print」, e.g. on `/courses/:id`.
- Course handout: labels live in `CONTENT_FIELDS`; a new content field must go in `HANDOUT_CONTENT_KEYS` (printed, reading order) or `HANDOUT_EXCLUDED_KEYS` (a spec enforces it). `CourseHandout` needs a `CourseService.getById` course (lists have no certifications). The handout QR uses `showCaption=false` and prints only while the public page is live (`publishStatus.isPublished` and today within `scheduleOn`–`scheduleOff`); otherwise a fallback line.

| Symptom | Cause |
|---|---|
| Blank page | Course not loaded or not found: the handout renders only with `item()` |
| No QR, fallback line instead | Course not published, or today is outside its schedule |
| No QR, blank box | Canvas not drawn yet; check the print preview again |
| CMS URL in the header/footer | `@page` margin boxes removed, or a browser that ignores them; uncheck 「頁首和頁尾」 in the print dialog |
| Tab title stuck as `…-課程講義` | `window.print()` threw; `print()` restores it in `finally` and shows a toast |

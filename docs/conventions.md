# Code conventions

Project rules for API and Angular code. Scaffolding patterns per table: `spec/code-gen.convention.md`.

## Backend (`src/CMS.API`)

- Dapper only. Per table: `{T}`, `{T}Request`, `{T}Query`, `I{T}Repository` + impl, controller `/api/{plural}`: `GET /`, `POST /query`, `GET /{id}`, `POST /`, `PUT /` (pkid in body), `DELETE /{id}`. Lookups go in `LookupsController` / `LookupRepository`.
- Register repos in `Program.cs`; swap in fakes in `CmsApiFactory` for tests (`src/CMS.API.Tests/Infrastructure/Fake*`).
- `RTRIM()` nchar columns; `date`/`time` → `DateOnly`/`TimeOnly`. n-n: delete-then-reinsert in one transaction.
- FK errors (SQL 547): delete blocked → `ReferenceConflictException` → 409; bad FK on write → `InvalidReferenceException` → 400.
- Backend-only columns (e.g. `AppUser.PasswordHash`): never in `{T}Request`, response models or SELECTs.
- Upsert on a natural key (idempotent resubmits): one `MERGE {T} WITH (HOLDLOCK) AS t USING (SELECT @Key1 AS Key1, ...) AS s ON t.Key1 = s.Key1 AND ... WHEN MATCHED THEN UPDATE SET ... WHEN NOT MATCHED THEN INSERT ...;` per row, all rows in one transaction (`conn.ExecuteAsync(sql, rows, tx)`). `HOLDLOCK` stops two concurrent callers from both inserting. Set absolute values (never `+=`) and leave rows missing from the payload untouched. Reject duplicate keys within one payload (400) before calling the repository. Example: `AgentTokenUsageRepository.UpsertAsync`.
- Per-action API key: an `IAuthorizationFilter` applied with a `TypeFilterAttribute` (`[RequireAgentApiKey]`), so 401 comes before `[ApiController]` model-validation 400; compare with `CryptographicOperations.FixedTimeEquals`. Tests set the key with `builder.UseSetting` in `CmsApiFactory`.
- "Now" comes from an injected `TimeProvider` (registered as `TimeProvider.System`); tests swap in `FixedTimeProvider` (`CmsApiFactory.Clock`).

## Frontend (`src/CMS.NG`)

- Standalone components, `inject()`, signals; lazy routes in `app.routes.ts` (`/new` before `/:id`); sidebar in `app.ts` `navGroups`; aliases `@core/*`, `@env/*`.
- List state: `session-state.util.ts` (`{table}-list-filters|sort|page`). Errors: `httpErrorMessage()`.
- Form pages: header toolbar is `<div class="page-header form-toolbar" data-testid="form-toolbar">` (pinned via the global rule in `styles.scss`); spec with `expectPinnedToolbar()` from `@core/testing/form-toolbar` in add and edit mode.
- Delete confirm: `確定要刪除主代碼 <b>{pkid}</b>「{name}」？` (escape name).
- Dates: local components, never `toISOString().split('T')[0]` (helpers in `core/utils/date.util.ts`); append `'Z'` to API datetimes before parsing.
- Prettier: width 100, single quotes. Run it only on files you create — existing files aren't Prettier-clean, so formatting them adds unrelated diff noise.

# Code conventions

Project rules for API and Angular code. Scaffolding patterns per table: `spec/code-gen.convention.md`.

## Backend (`src/CMS.API`)

- Dapper only. Per table: `{T}`, `{T}Request`, `{T}Query`, `I{T}Repository` + impl, controller `/api/{plural}`: `GET /`, `POST /query`, `GET /{id}`, `POST /`, `PUT /` (pkid in body), `DELETE /{id}`. Lookups go in `LookupsController` / `LookupRepository`.
- Register repos in `Program.cs`; swap in fakes in `CmsApiFactory` for tests (`src/CMS.API.Tests/Infrastructure/Fake*`).
- `RTRIM()` nchar columns; `date`/`time` → `DateOnly`/`TimeOnly`. n-n: delete-then-reinsert in one transaction.
- FK errors (SQL 547): delete blocked → `ReferenceConflictException` → 409; bad FK on write → `InvalidReferenceException` → 400.
- Backend-only columns (e.g. `AppUser.PasswordHash`): never in `{T}Request`, response models or SELECTs.

## Frontend (`src/CMS.NG`)

- Standalone components, `inject()`, signals; lazy routes in `app.routes.ts` (`/new` before `/:id`); sidebar in `app.ts` `navGroups`; aliases `@core/*`, `@env/*`.
- List state: `session-state.util.ts` (`{table}-list-filters|sort|page`). Errors: `httpErrorMessage()`.
- Delete confirm: `確定要刪除主代碼 <b>{pkid}</b>「{name}」？` (escape name).
- Dates: local components, never `toISOString().split('T')[0]` (helpers in `core/utils/date.util.ts`); append `'Z'` to API datetimes before parsing.
- Prettier: width 100, single quotes. Run it only on files you create — existing files aren't Prettier-clean, so formatting them adds unrelated diff noise.

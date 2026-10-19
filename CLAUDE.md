# CLAUDE.md

CMS admin back office: .NET 9 Web API (Dapper, SQL Server) + Angular 20 / PrimeNG 20 frontend.
Features are generated table-by-table from a spec, following fixed conventions.

## Layout

| Path | Contents |
|------|----------|
| `database/*.sql` | SQL Server schema scripts per sub-system (`admin`, `auth`, `course`, `promotion`). Source of truth for tables/columns. |
| `spec/code-gen.convention.md` | Backend/frontend code-generation patterns. **Read before adding a feature.** |
| `spec/feature-spec.template.md` | Template for a per-table build spec; `sample1.spec.md` (Course), `sample2.spec.md` (SkillTrain) are filled-in examples. |
| `spec/ui-sample-*.png` | Reference screenshots for list / view / add / edit pages. |
| `src/CMS.API` | Web API: `Controllers/`, `Models/`, `Repositories/` (interface + Dapper impl), `Data/` (connection factory, Dapper type handlers). |
| `src/CMS.API.Tests` | xUnit integration tests via `WebApplicationFactory<Program>` (`Infrastructure/CmsApiFactory.cs`) with in-memory fake repositories — no DB needed. |
| `src/CMS.NG` | Angular standalone app: `core/models`, `core/services`, `core/utils`, `features/{table-plural}/{table}-{list,detail,form}/`. |
| `src/README.md` | Run/test instructions and per-feature endpoint tables. |

## Commands

```powershell
cd src\CMS.API; dotnet run          # http://localhost:5000/swagger
cd src; dotnet test                 # backend tests
cd src\CMS.NG; npm start            # http://localhost:4200
cd src\CMS.NG; npx ng test --watch=false --browsers=ChromeHeadless
cd src\CMS.NG; npm run build
```

DB: SQL Server Express `.\SQLEXPRESS`, database `CMS`, connection string `ConnectionStrings:CMS` in `CMS.API/appsettings.json`.

## Key conventions (see `spec/code-gen.convention.md` for the full list)

- **Backend**: Dapper only (no EF). Per table: `{T}.cs` (response), `{T}Request.cs` (write DTO), `{T}Query.cs` (search DTO), `I{T}Repository` + `{T}Repository`, controller at `/api/{plural}`.
  Standard endpoints: `GET /`, `POST /query`, `GET /{id}`, `POST /`, `PUT /` (pkid in body), `DELETE /{id}`; slim lookups under `/api/lookups/{plural}` (`LookupsController`).
- Register each new repository in `Program.cs`, and swap it for a fake in `CmsApiFactory` when adding tests.
- `nchar` → `RTRIM()` in every SELECT. `date`/`time` → `DateOnly`/`TimeOnly` (handlers registered via `DapperConfig.RegisterTypeHandlers()`).
- n-n junctions: delete-then-reinsert inside the same transaction on save.
- **Frontend**: standalone components, `inject()`, signals; lazy routes in `app.routes.ts`; sidebar entries in `app.ts` (`navGroups`).
  Path aliases: `@core/*` → `src/app/core/*`, `@env/*` → `src/environments/*`. API base URL is `environment.apiUrl` (no dev proxy; API CORS allows any loopback origin).
- List pages persist state with `core/utils/session-state.util.ts` under `{table}-list-filters|sort|page`; error toasts use `httpErrorMessage()` from `core/utils/http-error.util.ts`.
- UI text is Traditional Chinese (labels from the spec's Localization section). Delete confirm: `確定要刪除主代碼 <b>{pkid}</b>「{name}」？` (HTML-escape the name).
- Dates: serialize with local date components, never `toISOString().split('T')[0]`; append `'Z'` to API `datetime` values before parsing.
- Prettier: `printWidth` 100, single quotes.

## Gotchas

- `spec/feature-spec.template.md` references `core/utils/date.util.ts`, `spec/dapper.md`, and `spec/inline-edit.md`, which **do not exist yet** — create them when the first feature needs them.
- Don't edit build output: `src/CMS.NG/dist`, `src/CMS.NG/.angular`, `bin/`, `obj/`.
- Git repo on `main`, remote `origin` = https://github.com/ying0515/cms-1019 (public). Record notable changes below as well as in commits.

## Implemented features

| Feature | Backend | Frontend routes |
|---------|---------|-----------------|
| AppRole (系統管理 Admin › 角色) | `AppRolesController`, `AppRoleRepository`; n-n users via `AppUserRole`; `GET /api/lookups/app-users` | `/app-roles`, `/app-roles/new`, `/app-roles/:id`, `/app-roles/:id/edit` |

## Change log

Keep this section current: after each meaningful change, add a dated one-line entry (newest first) and update the sections above if conventions, commands, or features changed.

- 2026-10-19 — Initialized git repo and pushed to GitHub (`ying0515/cms-1019`).
- 2026-10-19 — Added CLAUDE.md. Current state: AppRole feature (API + tests + Angular list/detail/form with specs); list page filter drawer (keyword, permission-level range, user) with session-persisted filters/sort/page.

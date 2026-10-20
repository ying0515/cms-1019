# Setup notes

Layout, environment, tooling gotchas and git. Features: `docs/features.md`. Change log: `docs/changelog.md`. Code rules: `docs/conventions.md`.

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

## Environment

- DB: SQL Server Express `.\SQLEXPRESS`, database `CMS`, connection string `ConnectionStrings:CMS` in `CMS.API/appsettings.json`.
- API base URL is `environment.apiUrl` (no dev proxy; API CORS allows any loopback origin).
- Production build: `cd src\CMS.NG; npm run build`.
- Dapper `date`/`time` handlers are registered via `DapperConfig.RegisterTypeHandlers()`.

### Tooling gotchas

- A running `dotnet run` locks `CMS.API/bin`, so `dotnet test` fails with MSB3027. Stop the API, or build elsewhere: `dotnet test --artifacts-path <temp dir>`.
- `sqlcmd` needs `-C` (trust the self-signed cert): `sqlcmd -S .\SQLEXPRESS -d CMS -E -C -Q "..."`.
- No Python on this machine; use PowerShell/Node for scripting.

## Git

- Remote `origin` = https://github.com/ying0515/cms-1019 (public).
- Branches: `develop` (GitHub default, day-to-day work) and `main`.
- Commit identity is set repo-locally (`git config user.name/user.email`).

## Pending

- `spec/feature-spec.template.md` references `spec/dapper.md`, which **does not exist yet** (`core/utils/date.util.ts` and `spec/inline-edit.md` now exist) — create it when the first feature needs it.

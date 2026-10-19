# CLAUDE.md

CMS back office: .NET 9 Web API (Dapper, SQL Server) + Angular 20 / PrimeNG 20, generated per table from a spec.

Layout, DB, git, features and change log: [docs/setup-notes.md](docs/setup-notes.md)

## Commands

```powershell
cd src\CMS.API; dotnet run    # :5000/swagger
cd src; dotnet test
cd src\CMS.NG; npm start      # :4200
cd src\CMS.NG; npx ng test --watch=false --browsers=ChromeHeadless
```

## Conventions

Read `spec/code-gen.convention.md` before adding a feature. Schema source of truth: `database/*.sql`.

- Dapper only. Per table: `{T}`, `{T}Request`, `{T}Query`, `I{T}Repository` + impl, controller `/api/{plural}`: `GET /`, `POST /query`, `GET /{id}`, `POST /`, `PUT /` (pkid in body), `DELETE /{id}`. Lookups in `LookupsController`.
- Register repos in `Program.cs`; swap in fakes in `CmsApiFactory` for tests.
- `RTRIM()` nchar columns; `date`/`time` → `DateOnly`/`TimeOnly`. n-n: delete-then-reinsert in one transaction.
- Angular: standalone, `inject()`, signals; lazy routes in `app.routes.ts`; sidebar in `app.ts` `navGroups`; aliases `@core/*`, `@env/*`.
- List state: `session-state.util.ts` (`{table}-list-filters|sort|page`). Errors: `httpErrorMessage()`.
- UI in Traditional Chinese. Delete confirm: `確定要刪除主代碼 <b>{pkid}</b>「{name}」？` (escape name).
- Dates: local components, never `toISOString().split('T')[0]`; append `'Z'` to API datetimes before parsing.
- Prettier: width 100, single quotes. Don't edit `dist/`, `.angular/`, `bin/`, `obj/`.

## Change log

After each meaningful change, add a dated entry to the change log in `docs/setup-notes.md` and update this file if conventions or commands change.

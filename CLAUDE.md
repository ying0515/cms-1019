# CLAUDE.md

CMS back office: .NET 9 Web API (Dapper, SQL Server) + Angular 20 / PrimeNG 20, one CRUD feature per DB table.

## Commands

```powershell
cd src\CMS.API; dotnet run    # :5000/swagger
cd src; dotnet test
cd src\CMS.NG; npm start      # :4200
cd src\CMS.NG; npx ng test --watch=false --browsers=ChromeHeadless
```

## Always

- UI text in Traditional Chinese. Schema source of truth: `database/*.sql`.
- Don't edit `dist/`, `.angular/`, `bin/`, `obj/`.
- After each meaningful change, add a dated line to the change log in `docs/setup-notes.md`.

## Read when needed

| File | Read before |
|------|-------------|
| `docs/conventions.md` | Writing or changing any API / Angular code |
| `spec/code-gen.convention.md` | Adding a feature (or use `/crud`) |
| `docs/setup-notes.md` | Env/DB/git questions, tooling gotchas, which features exist, change log |

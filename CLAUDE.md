CMS back office: .NET 9 Web API (Dapper, SQL Server) + Angular 20 / PrimeNG 20, one CRUD feature per DB table.

```powershell
cd src\CMS.API; dotnet run    # :5000/swagger
cd src; dotnet test
cd src\CMS.NG; npm start      # :4200
cd src\CMS.NG; npx ng test --watch=false --browsers=ChromeHeadless
```

## Always

- UI text in Traditional Chinese. Schema source of truth: `database/*.sql`.
- Don't edit `dist/`, `.angular/`, `bin/`, `obj/`.
- After each meaningful change, add a dated line at the top of `docs/changelog.md`.

## Read before

- `docs/conventions.md`: writing/changing API or Angular code
- `spec/code-gen.convention.md`: adding a feature (or `/crud`)
- `docs/features.md`: checking which features/routes exist
- `docs/setup-notes.md`: env/DB/git, tooling gotchas

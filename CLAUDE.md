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
- Every new repository and every detail / form page passes the cross-cutting checklist (row audit, error handling) at the top of `docs/conventions.md`.
- After each meaningful change, add a dated line at the top of `docs/changelog.md`.

## Read before

- `docs/conventions.md`: writing/changing API or Angular code
- `spec/code-gen.convention.md`: adding a feature (or `/crud`)
- `docs/features.md`: checking which features/routes exist
- `docs/setup-notes.md`: env/DB/git, tooling gotchas

## Agent skills

- **Issue tracker**: GitHub Issues `ying0515/cms-1019` via `gh`. See `docs/agents/issue-tracker.md`.
- **Triage labels**: the default five (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.
- **Domain docs**: single-context, root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.

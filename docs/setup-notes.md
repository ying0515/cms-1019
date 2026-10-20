# Setup notes

Layout, environment, tooling gotchas and git. Features: `docs/features.md`. Change log: `docs/changelog.md`. Code rules: `docs/conventions.md`.

## Layout

| Path | Contents |
|------|----------|
| `database/*.sql` | SQL Server schema scripts per sub-system (`admin`, `auth`, `course`, `promotion`, `agent`). Source of truth for tables/columns. `agent-seed.sql` seeds starting `ModelPrice` rows (re-runnable). |
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
- Apply a schema or seed script: `sqlcmd -S .\SQLEXPRESS -E -C -b -i database\agent.sql` (scripts start with `USE [CMS]`).
- No Python on this machine; use PowerShell/Node for scripting.

## Token report client (`tools/token-report/`)

Node.js (v24 on this machine), no npm dependencies. A user-level Claude Code `SessionEnd` hook (`hook.mjs`) starts a detached `worker.mjs`, which reads the session transcript (`~/.claude/projects/<dir>/<session>.jsonl` + `<session>/subagents/*.jsonl`), sums usage by Taipei date + model, and POSTs once to `{apiUrl}/api/agent-token-usage`. Result (or error) goes to one line in `~/.claude/token-report/worker.log`. No retries/outbox yet (#11): a send while the API is down is lost.

Tests (process-level: real child processes, temp HOME/USERPROFILE, fake HTTP server; never touch the real `~/.claude`):

```powershell
node --test "tools/token-report/test/*.test.mjs"
```

(`node --test tools/token-report` does not work on Node 24 — pass the glob.)

### Install (once per machine)

Run from the main checkout (the hook command stores this file's absolute path, so not from a temporary worktree):

```powershell
node tools\token-report\install.mjs
# or non-interactive:
node tools\token-report\install.mjs --api-url http://localhost:5000 --api-key dev-agent-token-key --user-id <AppUser.UserId>
```

- Writes `~/.claude/token-report/config.json` (`apiUrl`, `apiKey`, `userId`). `userId` must be an active `AppUser.UserId`; the dev key is `AgentTokenReport:ApiKey` in `appsettings.Development.json`.
- Copies `~/.claude/settings.json` to `settings.json.bak`, then appends `{ "hooks": [{ "type": "command", "command": "node \"<abs>/tools/token-report/hook.mjs\"" }] }` to `hooks.SessionEnd`. Other keys and hooks are kept. A second run changes nothing (an entry from an older checkout path is updated in place).
- Uninstall: remove that `SessionEnd` entry (or restore `settings.json.bak`) and delete `~/.claude/token-report/`.

### Manual check (not yet done on this machine)

1. Start the API: `cd src\CMS.API; dotnet run` (`:5000`).
2. Pick an active user: `sqlcmd -S .\SQLEXPRESS -d CMS -E -C -Q "SELECT UserId FROM AppUser WHERE IsActive=1"`.
3. From `C:\dev\cms`: `node tools\token-report\install.mjs` → URL `http://localhost:5000`, key `dev-agent-token-key`, that user ID.
4. Check `~/.claude/settings.json`: `SessionStart` (herdr) and other keys unchanged, new `SessionEnd` entry; `settings.json.bak` exists.
5. Start a new `claude` session in any repo, send one prompt, exit (`/exit`).
6. `Get-Content ~\.claude\token-report\worker.log -Tail 1` → `<session> <project> sent N item(s) -> 204`.
7. `sqlcmd ... -Q "SELECT * FROM AgentTokenUsage WHERE SessionId='<session>'"` shows rows, and `/agent-token-report` (`npm start`, :4200) lists them for today.

## Git

- Remote `origin` = https://github.com/ying0515/cms-1019 (public).
- Branches: `develop` (GitHub default, day-to-day work) and `main`.
- Commit identity is set repo-locally (`git config user.name/user.email`).

## Pending

- `spec/feature-spec.template.md` references `spec/dapper.md`, which **does not exist yet** (`core/utils/date.util.ts` and `spec/inline-edit.md` now exist) — create it when the first feature needs it.

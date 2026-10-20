# Build Spec for AgentTokenUsage
- database schema: `.\database\agent.sql`
- related: `spec/agent/ModelPrice.md` (cost source)

## Summary

Claude Code token consumption, reported automatically by a `SessionEnd` hook on each developer machine and shown as a read-only report. **Not a standard CRUD feature**: there is no create/edit/delete UI. Three parts:

1. **Ingest API**: `POST /api/agent-token-usage`, protected by an API key, upserts a session's absolute totals.
2. **Report**: `POST /api/agent-token-usage/report` + a read-only Angular page 「代理 Token 用量」.
3. **Client**: Node worker + installer in `tools/token-report/`.

| Item | Detail |
|------|--------|
| Primary Key | `pkid` int IDENTITY; natural key `(SessionId, UsageDate, Model)` UNIQUE |
| Foreign Keys | `UserId` → `AppUser.UserId` (nvarchar) |
| Required Fields | all except `Cost` |
| N-N Relationships | N/A |
| Primary-Foreign Links | N/A |
| Report Filters | UsageDate range, UserId, Project, Model |
| Report Grouping | `UserId, UsageDate, Project, Model` |
| Default Sort | `UsageDate DESC, UserId, Project, Model` |

### Key decisions

- **One row per session × Taipei date × model.** The client always sends the session's **absolute totals**, so resubmitting (resume, retry, catch-up) is idempotent. The report aggregates sessions.
- **Date** = each assistant message's own `timestamp` (UTC) converted to Asia/Taipei (UTC+8). A session crossing midnight produces rows on two dates.
- **Subagent usage** is folded into the parent session's rows (split by model like any other usage).
- **Cost** is computed server-side on upsert from `ModelPrice` (latest `EffectiveFrom <= UsageDate`); `NULL` if the model has no price. Changing prices recomputes (see ModelPrice spec). The report treats cost as an estimate.
- **Cache write** uses one column, priced at the 1-hour cache-write rate.

---

## Localization

### Chinese Table Name

- AgentTokenUsage: 代理 Token 用量
- Description: Claude Code 每個工作階段依日期與模型彙總的 Token 用量與成本

### Chinese Column Names

- pkid: 主代碼
- SessionId: 工作階段
- UsageDate: 日期
- Model: 模型
- UserId: 使用者
- Project: 專案
- InputTokens: 輸入 Token
- OutputTokens: 輸出 Token
- CacheWriteTokens: 快取寫入 Token
- CacheReadTokens: 快取讀取 Token
- Cost: 成本 (USD)
- UpdatedTime: 更新時間

Report-only label: TotalInputTokens (= Input + CacheWrite + CacheRead): 輸入 Token 合計. Null cost: 「未定價」. Totals row: 合計.

---

## Ingest API

### `POST /api/agent-token-usage`

Header: `X-Api-Key: <key>`. Compared in constant time (`CryptographicOperations.FixedTimeEquals`) against `AgentTokenReport:ApiKey` in appsettings (dev value in `appsettings.Development.json`). Implemented as an endpoint filter on this action only. Missing / wrong → **401**.

Body:

```json
{
  "sessionId": "42b40b91-7742-4c0a-a984-30d5ea1ff381",
  "userId": "ying",
  "project": "cms-1019",
  "items": [
    { "usageDate": "2026-10-19", "model": "claude-opus-5-5",
      "inputTokens": 120, "outputTokens": 45000,
      "cacheWriteTokens": 380000, "cacheReadTokens": 9100000 }
  ]
}
```

Validation → **400** (whole request rejected, nothing written):
- `sessionId`, `userId`, `project` empty / whitespace, or longer than the column
- `userId` not in `AppUser`, or `IsActive = 0`
- `items` empty
- any item: `model` empty, any token count `< 0`, `usageDate` after today in Asia/Taipei
- duplicate `(usageDate, model)` within `items`

Response: **204** on success.

Behavior: one transaction; per item a `MERGE ... WITH (HOLDLOCK)` on `(SessionId, UsageDate, Model)` that sets all token columns, `UserId`, `Project`, `Cost` (from the shared C# cost calculator; see the ModelPrice spec) and `UpdatedTime = GETUTCDATE()`. **Rows in the DB but absent from the payload are left untouched.** This is the first MERGE in the repo; document the pattern in `docs/conventions.md`.

### Models

```csharp
public class AgentTokenUsageSubmitRequest
{
    public string SessionId { get; set; } = "";
    public string UserId { get; set; } = "";
    public string Project { get; set; } = "";
    public List<AgentTokenUsageItem> Items { get; set; } = [];
}

public class AgentTokenUsageItem
{
    public DateOnly UsageDate { get; set; }
    public string Model { get; set; } = "";
    public long InputTokens { get; set; }
    public long OutputTokens { get; set; }
    public long CacheWriteTokens { get; set; }
    public long CacheReadTokens { get; set; }
}
```

"Today in Taipei": `TimeZoneInfo.FindSystemTimeZoneById("Taipei Standard Time")` (Windows id; `"Asia/Taipei"` also resolves on .NET 6+ with ICU). Inject a clock (`TimeProvider`) so tests can pin "today".

---

## Report

### `POST /api/agent-token-usage/report`

Body (`AgentTokenUsageReportQuery`): `UsageDateFrom?`, `UsageDateTo?` (inclusive), `UserId?`, `Project?`, `Model?`.

```sql
SELECT u.UserId, au.UserName, u.UsageDate, u.Project, u.Model,
       SUM(u.InputTokens) AS InputTokens, SUM(u.OutputTokens) AS OutputTokens,
       SUM(u.CacheWriteTokens) AS CacheWriteTokens, SUM(u.CacheReadTokens) AS CacheReadTokens,
       SUM(u.Cost) AS Cost,
       COUNT(CASE WHEN u.Cost IS NULL THEN 1 END) AS UnpricedCount,
       COUNT(DISTINCT u.SessionId) AS SessionCount
FROM AgentTokenUsage u
JOIN AppUser au ON au.UserId = u.UserId
WHERE (@UsageDateFrom IS NULL OR u.UsageDate >= @UsageDateFrom)
  AND (@UsageDateTo   IS NULL OR u.UsageDate <= @UsageDateTo)
  AND (@UserId  IS NULL OR u.UserId  = @UserId)
  AND (@Project IS NULL OR u.Project = @Project)
  AND (@Model   IS NULL OR u.Model   = @Model)
GROUP BY u.UserId, au.UserName, u.UsageDate, u.Project, u.Model
ORDER BY u.UsageDate DESC, u.UserId, u.Project, u.Model
```

A group with `UnpricedCount > 0` shows 「未定價」 (if all unpriced) or the partial cost with a warning icon + tooltip 「部分用量未定價」.

### Lookup Endpoints Required

| Route | Status | Returns |
|-------|--------|---------|
| `GET /api/lookups/app-users` | Exists | user filter dropdown |
| `GET /api/lookups/agent-token-projects` | New | `string[]` distinct `Project` ORDER BY Project |
| `GET /api/lookups/agent-token-models` | New | `string[]` distinct `Model` ORDER BY Model |

### Frontend: `features/agent-token-usage/agent-token-report/`

- Route `/agent-token-report`; sidebar group 「代理用量」 → 「代理 Token 用量」 (with 「模型價格」 from ModelPrice).
- Read-only. No detail / form / delete.
- Filter drawer (`p-drawer`): 日期 range (default: first day of current month → today, local date components via `date.util.ts`), 使用者 (`p-select`, label `UserId UserName`, `appendTo="body"`), 專案, 模型 (`p-select`, `[filter]="true"`).
- `p-table`, client-side sort + pagination. Columns: 日期, 使用者 (UserName), 專案, 模型, 輸入 Token 合計, 輸出 Token, 快取寫入 Token, 快取讀取 Token, 成本 (USD, `number:'1.4-4'`), 工作階段數.
- Token counts formatted with thousands separators.
- **Totals row** (`pTemplate="footer"`): 合計 of every numeric column over the **filtered** rows (all pages, not just the current page).
- Session storage keys: `agent-token-report-filters`, `agent-token-report-sort`, `agent-token-report-page`.

---

## Client: `tools/token-report/`

Node.js, **no npm dependencies** (built-in `fetch`, `node:fs`, `node:child_process`, `node:test`).

### Files

| File | Role |
|------|------|
| `hook.mjs` | `SessionEnd` command hook. Reads stdin JSON (`session_id`, `transcript_path`, `cwd`, `reason`), spawns `worker.mjs` **detached** (`stdio: 'ignore'`, `unref()`) with the input passed as an argument, exits 0 immediately (well inside the 1.5 s SessionEnd budget). Never throws. |
| `worker.mjs` | Builds payloads, writes outbox, sends outbox. |
| `parse.mjs` | Pure functions: transcript lines → items. Unit-tested. |
| `install.mjs` | Interactive setup (below). |

### Per-machine files: `~/.claude/token-report/`

- `config.json`: `{ "apiUrl": "http://localhost:5000", "apiKey": "...", "userId": "..." }`
- `outbox/<sessionId>.json`: pending payload (one per session; newer overwrites older)
- `outbox/rejected/<sessionId>.json`: payloads the API answered with 400
- `state.json`: `{ "lastSuccessAt": "<ISO>" }`
- `worker.log`: one line per run / error; truncated to the last ~512 KB when it passes 1 MB

### Parsing rules (`parse.mjs`)

Input: the main transcript `<session>.jsonl` plus every `<session>/subagents/agent-*.jsonl`.

1. Keep lines with `type === "assistant"` and a `message.usage`.
2. Skip `message.model === "<synthetic>"` and lines whose four token counts are all 0.
3. **Dedupe by `message.id`** across all files: one API response is logged once per content block, each line repeating the full usage.
4. `usageDate` = `timestamp` (UTC ISO) + 8 h → `YYYY-MM-DD`.
5. Map: `input_tokens` → inputTokens, `output_tokens` → outputTokens, `cache_creation_input_tokens` → cacheWriteTokens, `cache_read_input_tokens` → cacheReadTokens.
6. Sum by `(usageDate, model)`.
7. Unparseable lines are skipped (the format is internal and may change), counted, and logged.

`project`: `git -C <cwd> remote get-url origin` → last path segment without `.git` (handles `https://…/x.git` and `git@host:owner/x.git`); fallback: `basename(cwd)`. `cwd` comes from the hook input, or for catch-up from the transcript's first line with `cwd`.

### Worker flow

1. Load `config.json`; missing → log and exit.
2. Build the payload for the ending session → write `outbox/<sessionId>.json`.
3. **Catch-up**: scan `~/.claude/projects/*/*.jsonl` (and their `subagents/`) modified in the last **7 days** with mtime > `state.lastSuccessAt`; build and write an outbox file for each (skip sessions with no items).
4. Send every outbox file: `POST {apiUrl}/api/agent-token-usage` with `X-Api-Key`, 10 s timeout.
   - 2xx → delete the file
   - 400 → move to `rejected/`, log the response body
   - 401, 5xx, network error → keep for the next run
5. If every send succeeded, set `state.lastSuccessAt` to the time the run **started**.

### Installer (`node tools/token-report/install.mjs`)

- Prompts for `apiUrl` (default `http://localhost:5000`), `apiKey`, `userId`; writes `config.json`.
- Merges into `~/.claude/settings.json` (user level, so it covers every project): `hooks.SessionEnd` → `{ "type": "command", "command": "node \"<abs path>/hook.mjs\"" }`. Writes `settings.json.bak` first. Idempotent: no duplicate entry when re-run; never touches other hooks.
- Prints how to verify (end a session, check `worker.log` and the report page).
- Documented in `docs/setup-notes.md`.

---

## Tests

- **API** (`CMS.API.Tests`): every 400 rule, 401 (missing / wrong key), 204 + idempotent re-submit, rows absent from the payload untouched, cost with effective dates (before first price → NULL; price boundary day), Taipei "today" with a pinned clock.
- **Node** (`node --test "tools/token-report/test/*.test.mjs"`): fixtures for per-block duplicate lines, `<synthetic>`, a session crossing Taipei midnight, subagent files, mixed models, a malformed line, project-name parsing.
- **Angular**: report filters default to the current month, query built from the filters, totals row sums filtered rows, 「未定價」 rendering.

---

## Known gaps

- The rest of the API has no authentication; only the ingest POST is protected.
- `SessionEnd` is not documented to fire on crash, kill, or terminal close; the 7-day catch-up covers those cases.
- Transcripts are kept 30 days by default (`cleanupPeriodDays`); catch-up can't recover anything older.
- Cost is an estimate at list price; it doesn't separate 5-minute from 1-hour cache writes.

# Build Spec for ModelPrice
- database schema: `.\database\agent.sql`

## Summary

`ModelPrice` holds the USD list price per 1M tokens for each Claude model, effective from a date. `AgentTokenUsage.Cost` is computed from it (see `spec/agent/AgentTokenUsage.md`). Standard CRUD, built with `/crud`, plus one non-standard rule: **every create / update / delete recomputes the cost of affected `AgentTokenUsage` rows in the same transaction.**

| Item | Detail |
|------|--------|
| Primary Key | `pkid` int IDENTITY |
| Foreign Keys | None (`Model` is matched by exact string to `AgentTokenUsage.Model`, not an FK) |
| Required Fields | `Model`, `EffectiveFrom`, `InputPrice`, `OutputPrice`, `CacheWritePrice`, `CacheReadPrice` |
| N-N Relationships | N/A |
| Primary-Foreign Links | N/A |
| Query Filters | keyword (Model), EffectiveFrom range |
| Default Sort | `Model ASC, EffectiveFrom DESC` |

---

## Localization

### Chinese Table Name

- ModelPrice: 模型價格
- Description: 各 Claude 模型每百萬 Token 的美元定價（依生效日）

### Chinese Column Names

- pkid: 主代碼
- Model: 模型
- EffectiveFrom: 生效日
- InputPrice: 輸入單價
- OutputPrice: 輸出單價
- CacheWritePrice: 快取寫入單價
- CacheReadPrice: 快取讀取單價

Prices are shown with the suffix `USD / 1M tokens` (column header hint: 「美元／百萬 Token」).

---

## Required Fields

Required (NOT NULL):
- Model, EffectiveFrom, InputPrice, OutputPrice, CacheWritePrice, CacheReadPrice

Optional (nullable):
- None

Validation: all prices `>= 0`. `Model` trimmed; max 100.

---

## Foreign Keys

**N/A**

---

## Foreign-Primary Links

**N/A**

---

## Primary-Foreign Links

**N/A** (the report page is not filtered by ModelPrice pkid)

---

## N-N Relationships

**N/A**

---

## Query Filters

- **keyword**: LIKE on `Model`
- **Date range**: `EffectiveFrom` — `EffectiveFromFrom`, `EffectiveFromTo` (inclusive)

---

## Lookup Endpoints Required

| Route | Status | Returns |
|-------|--------|---------|
| — | — | None |

---

## API Endpoints

| Method | Route | Notes |
|--------|-------|-------|
| `GET` | `/api/model-prices` | List all |
| `POST` | `/api/model-prices/query` | Filtered query (body: `ModelPriceQuery`) |
| `GET` | `/api/model-prices/{id}` | Get by pkid |
| `POST` | `/api/model-prices` | Create; recompute cost |
| `PUT` | `/api/model-prices` | Update (pkid from body); recompute cost |
| `DELETE` | `/api/model-prices/{id}` | Delete; recompute cost |

Errors: duplicate `(Model, EffectiveFrom)` → `DuplicateKeyException` (409), message 「此模型在該生效日已有定價」.

Auth: none (same as the rest of the API).

---

## Backend Notes

### Models

```csharp
public class ModelPrice
{
    public int Pkid { get; set; }
    public string Model { get; set; } = "";
    public DateOnly EffectiveFrom { get; set; }
    public decimal InputPrice { get; set; }
    public decimal OutputPrice { get; set; }
    public decimal CacheWritePrice { get; set; }
    public decimal CacheReadPrice { get; set; }
}

public class ModelPriceRequest   // same fields; Pkid used only on PUT
public class ModelPriceQuery
{
    public string? Keyword { get; set; }
    public DateOnly? EffectiveFromFrom { get; set; }
    public DateOnly? EffectiveFromTo { get; set; }
}
```

### SQL — SELECT

```sql
SELECT pkid, Model, EffectiveFrom, InputPrice, OutputPrice, CacheWritePrice, CacheReadPrice
FROM ModelPrice
ORDER BY Model ASC, EffectiveFrom DESC
```

### SQL — INSERT / UPDATE

Writable: `Model, EffectiveFrom, InputPrice, OutputPrice, CacheWritePrice, CacheReadPrice`. INSERT ends with `SELECT CAST(SCOPE_IDENTITY() AS int)`.

### Cost recompute (non-standard)

Run inside the same transaction as the INSERT / UPDATE / DELETE, for every affected model (on UPDATE, both the old and new `Model` if it changed): load that model's prices and usage rows, recompute each row's cost in C#, and write the changed costs back.

**Cost is computed in C#, not SQL**, by one pure cost calculator shared with the `AgentTokenUsage` upsert. That keeps it testable at the HTTP seam with fake repositories, which never run SQL. Rule: pick the price with the latest `EffectiveFrom <= UsageDate` for the row's model; none → `NULL`; otherwise
`(Input × InputPrice + Output × OutputPrice + CacheWrite × CacheWritePrice + CacheRead × CacheReadPrice) / 1,000,000`.

Repositories only do plain reads and writes.

### Seed data

`database/agent-seed.sql`: rows for `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`, `EffectiveFrom = 2026-01-01`. Values taken from the `claude-api` skill's pricing reference at build time. `CacheWritePrice` = the **1-hour** cache-write rate; `CacheReadPrice` = cache-hit rate.

---

## Frontend Notes

### Delete Confirmation Message

```
確定要刪除主代碼 <b>${item.pkid}</b>「${item.model} ${item.effectiveFrom}」？
```
Add a second line: 「相關的 Token 用量成本將重新計算。」

### Session Storage Keys

| Key | Contents |
|-----|----------|
| `model-price-list-filters` | Last query filter values |
| `model-price-list-sort` | `{ sortField, sortOrder }` |
| `model-price-list-page` | `{ first, rows }` |

### Date Handling

`EffectiveFrom` is `date` → `p-datepicker`; serialize with `core/utils/date.util.ts` helpers.

### Special Form Behaviors

- Price inputs: `p-inputnumber` with `[minFractionDigits]="2" [maxFractionDigits]="6" [min]="0"`.
- Show a hint under the form: 「儲存後將重新計算此模型相關的 Token 用量成本。」

### Sidebar nav

New nav group 「代理用量」 containing 「代理 Token 用量」 (`/agent-token-report`) and 「模型價格」 (`/model-prices`).

### Sub-panels

**N/A**

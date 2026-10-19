# Build Spec for PublishStatus
- database schema: .\database\admin.sql

## Summary

`PublishStatus` is a small code table of publishing states (e.g. 草稿 / 已發布 / 已下架) used by `Course` and `Promotion2`. Each row has a description plus three flags (`IsDraft`, `IsPublished`, `IsDiscontinued`) that tell consuming features how to treat items in that state. The PK is a **non-identity `tinyint`** — the pkid is entered by the user on create and is read-only on edit.

| Item | Detail |
|------|--------|
| Primary Key | `pkid` tinyint, **not** IDENTITY (user-supplied on create, immutable) |
| Foreign Keys | None |
| Required Fields | `pkid`, `Description`, `IsDraft`, `IsPublished`, `IsDiscontinued` |
| N-N Relationships | N/A |
| Primary-Foreign Links | `Course.PublishStatus_pkid` (course.sql), `Promotion2.PublishStatus_pkid` (promotion.sql) — features not built yet; links deferred |
| Query Filters | keyword (Description), IsDraft, IsPublished, IsDiscontinued |
| Default Sort | `pkid ASC` |

---

## Localization

### Chinese Table Name

- PublishStatus: 發布狀態
- Description: 課程與促銷活動的發布狀態代碼

### Chinese Column Names

- pkid: 主代碼
- Description: 狀態名稱
- IsDraft: 草稿
- IsPublished: 已發布
- IsDiscontinued: 已停用

---

## Required Fields

All columns are NOT NULL:

- `pkid` NOT NULL (user-entered, 0–255, must be unique)
- `Description` NOT NULL (max 50)
- `IsDraft` NOT NULL
- `IsPublished` NOT NULL
- `IsDiscontinued` NOT NULL

Optional (nullable): none.

---

## Foreign Keys

`PublishStatus` has no foreign key columns.

N/A

---

## Foreign-Primary Links

N/A

---

## Primary-Foreign Links

The following tables reference `PublishStatus.pkid`:

- **Course** (`PublishStatus_pkid`) — column header 對應課程, button 查看課程 (`pi pi-book`), target `/courses?publishStatusPkid={pkid}`
- **Promotion2** (`PublishStatus_pkid`) — column header 對應促銷活動, button 查看促銷活動 (`pi pi-megaphone`), target `/promotions?publishStatusPkid={pkid}`

Neither feature exists yet, so **no link buttons are generated now**. Add them when Course / Promotion2 are built (their list pages must accept the `publishStatusPkid` query param).

Because these FKs exist, deleting a status that is in use fails with SQL error 547 → API returns **409 Conflict** with message `發布狀態「{Description}」已被使用，無法刪除`.

---

## N-N Relationships

N/A

---

## Query Filters

- **keyword**: string — LIKE on `Description`
- **IsDraft**: bool? — exact match (tri-state: null = 全部)
- **IsPublished**: bool? — exact match
- **IsDiscontinued**: bool? — exact match

---

## Lookup Endpoints Required

| Route | Status | Returns |
|-------|--------|---------|
| `GET /api/lookups/publish-statuses` | New | `{ pkid, description }[]` ordered by `pkid ASC` (for Course / Promotion2 dropdowns) |

---

## API Endpoints

| Method | Route | Notes |
|--------|-------|-------|
| `GET` | `/api/publish-statuses` | List all |
| `POST` | `/api/publish-statuses/query` | Filtered query (body: `PublishStatusQuery`) |
| `GET` | `/api/publish-statuses/{id}` | Get by pkid |
| `POST` | `/api/publish-statuses` | Create — pkid from body; **409** if pkid already exists |
| `PUT` | `/api/publish-statuses` | Update (pkid from body; pkid itself is not changeable) |
| `DELETE` | `/api/publish-statuses/{id}` | Delete — **409** if referenced by Course / Promotion2 |

Route constraint `{id:int}`; values outside 0–255 return 404.

---

## Backend Notes

### Models

```csharp
public class PublishStatus
{
    public byte Pkid { get; set; }
    public string Description { get; set; } = string.Empty;
    public bool IsDraft { get; set; }
    public bool IsPublished { get; set; }
    public bool IsDiscontinued { get; set; }
}

public class PublishStatusRequest
{
    public byte Pkid { get; set; }
    [Required, StringLength(50)]
    public string Description { get; set; } = string.Empty;
    public bool IsDraft { get; set; }
    public bool IsPublished { get; set; }
    public bool IsDiscontinued { get; set; }
}

public class PublishStatusQuery
{
    public string? Keyword { get; set; }
    public bool? IsDraft { get; set; }
    public bool? IsPublished { get; set; }
    public bool? IsDiscontinued { get; set; }
}

public class PublishStatusLookup
{
    public byte Pkid { get; set; }
    public string Description { get; set; } = string.Empty;
}
```

### SQL — SELECT

```sql
SELECT s.pkid, s.Description, s.IsDraft, s.IsPublished, s.IsDiscontinued
FROM PublishStatus s
ORDER BY s.pkid ASC
```

### SQL — INSERT

pkid is not IDENTITY, so it is inserted explicitly and no `SCOPE_IDENTITY()`:

```sql
INSERT INTO PublishStatus (pkid, Description, IsDraft, IsPublished, IsDiscontinued)
VALUES (@Pkid, @Description, @IsDraft, @IsPublished, @IsDiscontinued);
```

### SQL — UPDATE

```sql
UPDATE PublishStatus
SET Description = @Description, IsDraft = @IsDraft, IsPublished = @IsPublished, IsDiscontinued = @IsDiscontinued
WHERE pkid = @Pkid
```

### SQL — DELETE

`DELETE FROM PublishStatus WHERE pkid = @pkid`; catch `SqlException` 547 and surface as `ReferenceConflictException` → controller 409.

### Special Column Notes

- No `nchar`, date/time, or computed columns.
- `Description` is trimmed on create/update.
- RowAudit: no `RowAuditWriter` exists in the codebase yet (AppRole doesn't use one) — skipped.

---

## Frontend Notes

### Routes

| Path | Component | Title |
|------|-----------|-------|
| `/publish-statuses` | `PublishStatusList` | 發布狀態 PublishStatus |
| `/publish-statuses/new` | `PublishStatusForm` | 新增發布狀態 |
| `/publish-statuses/:id` | `PublishStatusDetail` | 檢視發布狀態 |
| `/publish-statuses/:id/edit` | `PublishStatusForm` | 編輯發布狀態 |

### Model (`core/models/publish-status.model.ts`)

```ts
export interface PublishStatus { pkid: number; description: string; isDraft: boolean; isPublished: boolean; isDiscontinued: boolean; }
export interface PublishStatusRequest { pkid: number; description: string; isDraft: boolean; isPublished: boolean; isDiscontinued: boolean; }
export interface PublishStatusQuery { keyword?: string | null; isDraft?: boolean | null; isPublished?: boolean | null; isDiscontinued?: boolean | null; }
```

### List

- Columns: 主代碼, 狀態名稱 (link to detail), 草稿, 已發布, 已停用 (check / dash icons, centered), 操作 (view / edit / delete).
- Default sort `pkid` ASC.
- Filter drawer: 關鍵字 (`pInputText`, placeholder 狀態名稱); 草稿 / 已發布 / 已停用 as `p-select` with options 全部 (null) / 是 (true) / 否 (false), `appendTo="body"`.

### Detail

- Read-only card with all five fields; flags shown as 是 / 否 tags. Toolbar: 返回, 編輯, 刪除.

### Form

- `pkid`: `p-inputnumber` 0–255, required; **disabled in edit mode**.
- `description`: `pInputText`, required, maxlength 50.
- `isDraft`, `isPublished`, `isDiscontinued`: `p-checkbox` binary.
- Sticky `p-toolbar` with 取消 / 儲存. 409 on create shows `主代碼 {pkid} 已存在`.

### Delete Confirmation

```
確定要刪除主代碼 <b>${item.pkid}</b>「${escapeHtml(item.description)}」？
```

### Session Storage Keys

| Key | Contents |
|-----|----------|
| `publish-status-list-filters` | Last query filter values |
| `publish-status-list-sort` | `{ sortField, sortOrder }` |
| `publish-status-list-page` | `{ first, rows }` |

### Sidebar

Existing group **系統管理 Admin** → `發布狀態 PublishStatus` (`pi pi-flag`, `/publish-statuses`).

---

## Tests

### Backend (`CMS.API.Tests`)

- `Infrastructure/FakePublishStatusRepository.cs` (seed 1 草稿, 2 已發布, 3 已下架; pkid 2 marked "in use") + register in `CmsApiFactory`.
- `PublishStatusesControllerTests.cs`: GetAll sorted; query by keyword / each flag; get found / 404; create 201 / duplicate 409 / missing Description 400 / too long 400; update 204 / 404 / 400; delete 204 / 404 / in-use 409; `GET /api/lookups/publish-statuses`.

### Frontend

- `publish-status.service.spec.ts`, `lookup.service.spec.ts` (new method)
- `publish-status-list.spec.ts`, `publish-status-detail.spec.ts`, `publish-status-form.spec.ts`

---

## Files to Create / Modify

| Area | File | Action |
|------|------|--------|
| API | `Models/PublishStatus.cs`, `PublishStatusRequest.cs`, `PublishStatusQuery.cs`, `PublishStatusLookup.cs` | Create |
| API | `Repositories/IPublishStatusRepository.cs`, `PublishStatusRepository.cs`, `ReferenceConflictException.cs` | Create |
| API | `Controllers/PublishStatusesController.cs` | Create |
| API | `Repositories/ILookupRepository.cs`, `LookupRepository.cs`, `Controllers/LookupsController.cs`, `Program.cs` | Modify |
| Tests | `PublishStatusesControllerTests.cs`, `Infrastructure/FakePublishStatusRepository.cs`, `Infrastructure/CmsApiFactory.cs` | Create / Modify |
| NG | `core/models/publish-status.model.ts`, `core/services/publish-status.service.ts` (+ spec) | Create |
| NG | `core/models/lookup.model.ts`, `core/services/lookup.service.ts` (+ spec) | Modify |
| NG | `features/publish-statuses/publish-status-{list,detail,form}/*` (+ specs), `testing/publish-status.fixtures.ts` | Create |
| NG | `app.routes.ts`, `app.ts` | Modify |

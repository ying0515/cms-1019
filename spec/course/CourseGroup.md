# Build Spec for CourseGroup
- database schema: .\database\course.sql

## Summary

`CourseGroup` is a small code table of course categories (e.g. 雲端運算, 資訊安全, 網路). It is used to group `Course` rows (optional FK) and is mapped to partners through `PartnerCourseGroup` (which carries its own display order and description per partner).

| Item | Detail |
|------|--------|
| Primary Key | `pkid` smallint IDENTITY |
| Foreign Keys | None |
| Required Fields | `Description` |
| N-N Relationships | N/A (`PartnerCourseGroup` has its own pkid + DisplayOrder + Description, so it is a child entity, not a pure junction) |
| Primary-Foreign Links | `Course.CourseGroup_pkid` (nullable), `PartnerCourseGroup.CourseGroup_pkid` — features not built yet; links deferred |
| Query Filters | keyword (Description) |
| Default Sort | `pkid DESC` (no DisplayOrder column) |

---

## Localization

### Chinese Table Name

- CourseGroup: 課程群組
- Description: 課程分類群組代碼

### Chinese Column Names

- pkid: 主代碼
- Description: 群組名稱

---

## Required Fields

Required (NOT NULL):
- `Description` (max 100)

Optional (nullable): none.

---

## Foreign Keys

N/A

---

## Foreign-Primary Links

N/A

---

## Primary-Foreign Links

The following tables reference `CourseGroup.pkid`:

- **Course** (`CourseGroup_pkid`, nullable) — column header 對應課程, button 查看課程 (`pi pi-book`), target `/courses?courseGroupPkid={pkid}`
- **PartnerCourseGroup** (`CourseGroup_pkid`) — column header 對應廠商課程群組, button 查看廠商課程群組 (`pi pi-sitemap`), target `/partner-course-groups?courseGroupPkid={pkid}`

Neither feature exists yet, so **no link buttons are generated now**. Add them when Course / PartnerCourseGroup are built (their list pages must accept the `courseGroupPkid` query param).

Because these FKs exist, deleting a group that is in use fails with SQL error 547 → API returns **409 Conflict** with message `課程群組「{Description}」已被使用，無法刪除` (reuses `ReferenceConflictException`).

---

## N-N Relationships

N/A

---

## Query Filters

- **keyword**: string — LIKE on `Description`

No FK, bit or date columns → no other filters.

---

## Lookup Endpoints Required

| Route | Status | Returns |
|-------|--------|---------|
| `GET /api/lookups/course-groups` | New | `{ pkid, description }[]` ordered by `pkid ASC` (for Course / PartnerCourseGroup dropdowns, per `sample1.spec.md`) |

---

## API Endpoints

| Method | Route | Notes |
|--------|-------|-------|
| `GET` | `/api/course-groups` | List all |
| `POST` | `/api/course-groups/query` | Filtered query (body: `CourseGroupQuery`) |
| `GET` | `/api/course-groups/{id}` | Get by pkid |
| `POST` | `/api/course-groups` | Create → 201 with created entity (pkid from `SCOPE_IDENTITY()`; body pkid ignored) |
| `PUT` | `/api/course-groups` | Update (pkid from body) |
| `DELETE` | `/api/course-groups/{id}` | Delete — **409** if referenced |

Route constraint `{id:int}`; values outside smallint range return 404.

---

## Backend Notes

### Models

```csharp
public class CourseGroup
{
    public short Pkid { get; set; }
    public string Description { get; set; } = string.Empty;
}

public class CourseGroupRequest
{
    public short Pkid { get; set; }                       // ignored on create
    [Required, StringLength(100)] public string Description { get; set; } = string.Empty;
}

public class CourseGroupQuery
{
    public string? Keyword { get; set; }
}

public class CourseGroupLookup
{
    public short Pkid { get; set; }
    public string Description { get; set; } = string.Empty;
}
```

### SQL — SELECT

```sql
SELECT g.pkid, g.Description
FROM CourseGroup g
ORDER BY g.pkid DESC
```

### SQL — INSERT

```sql
INSERT INTO CourseGroup (Description) VALUES (@Description);
SELECT CAST(SCOPE_IDENTITY() AS smallint);
```

### SQL — UPDATE

```sql
UPDATE CourseGroup SET Description = @Description WHERE pkid = @Pkid
```

### SQL — DELETE

`DELETE FROM CourseGroup WHERE pkid = @pkid`; catch `SqlException` 547 → `ReferenceConflictException` → controller 409.

### Special Column Notes

- No `nchar`, date/time, or computed columns.
- `Description` is trimmed on create/update.
- RowAudit: no `RowAuditWriter` exists in the codebase yet — skipped (same as Partner / PublishStatus).

---

## Frontend Notes

### Routes

| Path | Component | Title |
|------|-----------|-------|
| `/course-groups` | `CourseGroupList` | 課程群組 CourseGroup |
| `/course-groups/new` | `CourseGroupForm` | 新增課程群組 |
| `/course-groups/:id` | `CourseGroupDetail` | 檢視課程群組 |
| `/course-groups/:id/edit` | `CourseGroupForm` | 編輯課程群組 |

### Model (`core/models/course-group.model.ts`)

```ts
export interface CourseGroup { pkid: number; description: string; }
export interface CourseGroupRequest { pkid: number; description: string; }
export interface CourseGroupQuery { keyword?: string | null; }
```

### List

- Columns: 主代碼, 群組名稱 (link to detail), 操作 (view / edit / delete).
- Default sort `pkid` DESC.
- Filter drawer: 關鍵字 (`pInputText`, placeholder 群組名稱).

### Detail

- Read-only card with both fields. Toolbar: 返回, 編輯, 刪除.

### Form

- `pkid`: shown read-only in edit mode only (IDENTITY).
- `description`: `pInputText`, required (not blank), maxlength 100.
- Page-header toolbar with 取消 / 儲存. After create, navigate to the new detail page.

### Delete Confirmation

```
確定要刪除主代碼 <b>${item.pkid}</b>「${escapeHtml(item.description)}」？
```

### Session Storage Keys

| Key | Contents |
|-----|----------|
| `course-group-list-filters` | Last query filter values |
| `course-group-list-sort` | `{ sortField, sortOrder }` |
| `course-group-list-page` | `{ first, rows }` |

### Sidebar

Existing group **課程管理 Course** → `課程群組 CourseGroup` (`pi pi-tags`, `/course-groups`), after 合作廠商 Partner.

---

## Tests

### Backend (`CMS.API.Tests`)

- `Infrastructure/FakeCourseGroupRepository.cs` (seed 1 雲端運算, 2 資訊安全, 3 網路; pkid 1 marked "in use") + register in `CmsApiFactory`; `FakeLookupRepository` gains course groups.
- `CourseGroupsControllerTests.cs`: GetAll sorted pkid desc; query by keyword / no match; get found / 404 / out of range; create 201 (trimmed, identity pkid, body pkid ignored, Location header) / missing / blank / too long 400; update 204 / 404 / 400; delete 204 / 404 / in-use 409; `GET /api/lookups/course-groups`.

### Frontend

- `course-group.service.spec.ts`, `lookup.service.spec.ts` (new method)
- `course-group-list.spec.ts`, `course-group-detail.spec.ts`, `course-group-form.spec.ts`, `app.spec.ts` (sidebar entry)

---

## Files to Create / Modify

| Area | File | Action |
|------|------|--------|
| API | `Models/CourseGroup.cs`, `CourseGroupRequest.cs`, `CourseGroupQuery.cs`, `CourseGroupLookup.cs` | Create |
| API | `Repositories/ICourseGroupRepository.cs`, `CourseGroupRepository.cs` | Create |
| API | `Controllers/CourseGroupsController.cs` | Create |
| API | `Repositories/ILookupRepository.cs`, `LookupRepository.cs`, `Controllers/LookupsController.cs`, `Program.cs` | Modify |
| Tests | `CourseGroupsControllerTests.cs`, `Infrastructure/FakeCourseGroupRepository.cs` | Create |
| Tests | `Infrastructure/CmsApiFactory.cs`, `Infrastructure/FakeLookupRepository.cs` | Modify |
| NG | `core/models/course-group.model.ts`, `core/services/course-group.service.ts` (+ spec) | Create |
| NG | `core/models/lookup.model.ts`, `core/services/lookup.service.ts` (+ spec) | Modify |
| NG | `features/course-groups/course-group-{list,detail,form}/*` (+ specs), `features/course-groups/testing/course-group.fixtures.ts` | Create |
| NG | `app.routes.ts`, `app.ts`, `app.spec.ts` | Modify |

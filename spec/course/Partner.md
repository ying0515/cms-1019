# Build Spec for Partner
- database schema: .\database\course.sql (identical definition in .\database\promotion.sql)

## Summary

`Partner` is the code table of training partners / vendors (e.g. Microsoft, Cisco, AWS). Each partner has an internal name, an app key, the labels shown on the public partner menu and on the course detail page, a display order, and an optional logo filename. It is the FK target for `Course`, `Certification`, `PartnerCourseGroup` and `Promotion2.RelatedPartner_pkid`.

| Item | Detail |
|------|--------|
| Primary Key | `pkid` smallint IDENTITY |
| Foreign Keys | None |
| Required Fields | `Name`, `AppKey`, `NameOnPartnerMenu`, `NameOnCourseDetailPage`, `DisplayOrder` |
| N-N Relationships | N/A (`PartnerCourseGroup` has its own pkid + DisplayOrder + Description, so it is a child entity, not a pure junction) |
| Primary-Foreign Links | `Course.Partner_pkid`, `Certification.Partner_pkid`, `PartnerCourseGroup.Partner_pkid` (course.sql); `Promotion2.RelatedPartner_pkid` (promotion.sql) — features not built yet; links deferred |
| Query Filters | keyword (Name, AppKey, NameOnPartnerMenu, NameOnCourseDetailPage, ImageFilename) |
| Default Sort | `DisplayOrder ASC, pkid DESC` |

---

## Localization

### Chinese Table Name

- Partner: 合作廠商
- Description: 原廠／合作夥伴主資料（課程、認證、課程群組所屬廠商）

### Chinese Column Names

- pkid: 主代碼
- Name: 廠商名稱
- AppKey: 應用代碼
- NameOnPartnerMenu: 廠商選單名稱
- NameOnCourseDetailPage: 課程頁顯示名稱
- DisplayOrder: 顯示順序
- ImageFilename: 圖檔名稱

---

## Required Fields

Required (NOT NULL):
- `Name` (max 50)
- `AppKey` (varchar max 10)
- `NameOnPartnerMenu` (max 200)
- `NameOnCourseDetailPage` (max 50)
- `DisplayOrder` (int)

Optional (nullable):
- `ImageFilename` (varchar max 50)

---

## Foreign Keys

N/A

---

## Foreign-Primary Links

N/A

---

## Primary-Foreign Links

The following tables reference `Partner.pkid`:

- **Course** (`Partner_pkid`) — column header 對應課程, button 查看課程 (`pi pi-book`), target `/courses?partnerPkid={pkid}`
- **Certification** (`Partner_pkid`) — column header 對應認證, button 查看認證 (`pi pi-verified`), target `/certifications?partnerPkid={pkid}`
- **PartnerCourseGroup** (`Partner_pkid`) — column header 對應課程群組, button 查看課程群組 (`pi pi-sitemap`), target `/partner-course-groups?partnerPkid={pkid}`
- **Promotion2** (`RelatedPartner_pkid`) — column header 對應促銷活動, button 查看促銷活動 (`pi pi-megaphone`), target `/promotions?relatedPartnerPkid={pkid}`

None of these features exist yet, so **no link buttons are generated now**. Add them when those features are built (their list pages must accept the query param above).

Because these FKs exist, deleting a partner that is in use fails with SQL error 547 → API returns **409 Conflict** with message `合作廠商「{Name}」已被使用，無法刪除` (reuses `ReferenceConflictException`).

(`Seminar.Partner_pkid` in promotion.sql has no declared FK constraint, so it does not block delete.)

---

## N-N Relationships

N/A

---

## Query Filters

- **keyword**: string — LIKE on `Name`, `AppKey`, `NameOnPartnerMenu`, `NameOnCourseDetailPage`, `ImageFilename`

No FK, bit or date columns → no other filters.

---

## Lookup Endpoints Required

| Route | Status | Returns |
|-------|--------|---------|
| `GET /api/lookups/partners` | New | `{ pkid, name }[]` ordered by `DisplayOrder ASC, pkid ASC` (for Course / Certification / PartnerCourseGroup / Promotion2 dropdowns) |

---

## API Endpoints

| Method | Route | Notes |
|--------|-------|-------|
| `GET` | `/api/partners` | List all |
| `POST` | `/api/partners/query` | Filtered query (body: `PartnerQuery`) |
| `GET` | `/api/partners/{id}` | Get by pkid |
| `POST` | `/api/partners` | Create → 201 with created entity (pkid from `SCOPE_IDENTITY()`) |
| `PUT` | `/api/partners` | Update (pkid from body) |
| `DELETE` | `/api/partners/{id}` | Delete — **409** if referenced |

Route constraint `{id:int}`; values outside smallint range (1–32767) return 404.

---

## Backend Notes

### Models

```csharp
public class Partner
{
    public short Pkid { get; set; }
    public string Name { get; set; } = string.Empty;
    public string AppKey { get; set; } = string.Empty;
    public string NameOnPartnerMenu { get; set; } = string.Empty;
    public string NameOnCourseDetailPage { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public string? ImageFilename { get; set; }
}

public class PartnerRequest
{
    public short Pkid { get; set; }                       // ignored on create
    [Required, StringLength(50)]  public string Name { get; set; } = string.Empty;
    [Required, StringLength(10)]  public string AppKey { get; set; } = string.Empty;
    [Required, StringLength(200)] public string NameOnPartnerMenu { get; set; } = string.Empty;
    [Required, StringLength(50)]  public string NameOnCourseDetailPage { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    [StringLength(50)]            public string? ImageFilename { get; set; }
}

public class PartnerQuery
{
    public string? Keyword { get; set; }
}

public class PartnerLookup
{
    public short Pkid { get; set; }
    public string Name { get; set; } = string.Empty;
}
```

### SQL — SELECT

```sql
SELECT p.pkid, p.Name, p.AppKey, p.NameOnPartnerMenu, p.NameOnCourseDetailPage,
       p.DisplayOrder, p.ImageFilename
FROM Partner p
ORDER BY p.DisplayOrder ASC, p.pkid DESC
```

### SQL — INSERT

```sql
INSERT INTO Partner (Name, AppKey, NameOnPartnerMenu, NameOnCourseDetailPage, DisplayOrder, ImageFilename)
VALUES (@Name, @AppKey, @NameOnPartnerMenu, @NameOnCourseDetailPage, @DisplayOrder, @ImageFilename);
SELECT CAST(SCOPE_IDENTITY() AS smallint);
```

### SQL — UPDATE

```sql
UPDATE Partner
SET Name = @Name, AppKey = @AppKey, NameOnPartnerMenu = @NameOnPartnerMenu,
    NameOnCourseDetailPage = @NameOnCourseDetailPage, DisplayOrder = @DisplayOrder,
    ImageFilename = @ImageFilename
WHERE pkid = @Pkid
```

### SQL — DELETE

`DELETE FROM Partner WHERE pkid = @pkid`; catch `SqlException` 547 → `ReferenceConflictException` → controller 409.

### Special Column Notes

- No `nchar`, date/time, or computed columns.
- String fields are trimmed on create/update; blank `ImageFilename` is stored as NULL.
- RowAudit: no `RowAuditWriter` exists in the codebase yet — skipped (same as PublishStatus).

---

## Frontend Notes

### Routes

| Path | Component | Title |
|------|-----------|-------|
| `/partners` | `PartnerList` | 合作廠商 Partner |
| `/partners/new` | `PartnerForm` | 新增合作廠商 |
| `/partners/:id` | `PartnerDetail` | 檢視合作廠商 |
| `/partners/:id/edit` | `PartnerForm` | 編輯合作廠商 |

### Model (`core/models/partner.model.ts`)

```ts
export interface Partner { pkid: number; name: string; appKey: string; nameOnPartnerMenu: string; nameOnCourseDetailPage: string; displayOrder: number; imageFilename: string | null; }
export interface PartnerRequest { pkid: number; name: string; appKey: string; nameOnPartnerMenu: string; nameOnCourseDetailPage: string; displayOrder: number; imageFilename: string | null; }
export interface PartnerQuery { keyword?: string | null; }
```

### List

- Columns: 主代碼, 廠商名稱 (link to detail), 應用代碼, 廠商選單名稱, 課程頁顯示名稱, 顯示順序, 圖檔名稱, 操作 (view / edit / delete).
- Default sort `displayOrder` ASC (server order `DisplayOrder ASC, pkid DESC`).
- Filter drawer: 關鍵字 (`pInputText`, placeholder 廠商名稱 / 應用代碼 / 選單名稱 / 圖檔).

### Detail

- Read-only card with all seven fields (圖檔名稱 shows `—` when null). Toolbar: 返回, 編輯, 刪除.

### Form

- `pkid`: shown read-only in edit mode only (IDENTITY).
- `name`: `pInputText`, required, maxlength 50.
- `appKey`: `pInputText`, required, maxlength 10.
- `nameOnPartnerMenu`: `pInputText`, required, maxlength 200.
- `nameOnCourseDetailPage`: `pInputText`, required, maxlength 50.
- `displayOrder`: `p-inputnumber`, required, integer, default 0.
- `imageFilename`: `pInputText`, optional, maxlength 50.
- Sticky `p-toolbar` with 取消 / 儲存. After create, navigate to the new detail page.

### Delete Confirmation

```
確定要刪除主代碼 <b>${item.pkid}</b>「${escapeHtml(item.name)}」？
```

### Session Storage Keys

| Key | Contents |
|-----|----------|
| `partner-list-filters` | Last query filter values |
| `partner-list-sort` | `{ sortField, sortOrder }` |
| `partner-list-page` | `{ first, rows }` |

### Sidebar

New group **課程管理 Course** (key `course`, icon `pi pi-book`) → `合作廠商 Partner` (`pi pi-building`, `/partners`).

---

## Tests

### Backend (`CMS.API.Tests`)

- `Infrastructure/FakePartnerRepository.cs` (seed 1 Microsoft order 1, 2 Cisco order 2, 3 AWS order 1; pkid 1 marked "in use") + register in `CmsApiFactory`; `FakeLookupRepository` gains partners.
- `PartnersControllerTests.cs`: GetAll sorted by DisplayOrder then pkid desc; query by keyword (each column) / no match; get found / 404 / out of range; create 201 (trimmed, blank image → null, Location header) / missing each required field 400 / too long 400; update 204 / 404 / 400; delete 204 / 404 / in-use 409; `GET /api/lookups/partners`.

### Frontend

- `partner.service.spec.ts`, `lookup.service.spec.ts` (new method)
- `partner-list.spec.ts`, `partner-detail.spec.ts`, `partner-form.spec.ts`

---

## Files to Create / Modify

| Area | File | Action |
|------|------|--------|
| API | `Models/Partner.cs`, `PartnerRequest.cs`, `PartnerQuery.cs`, `PartnerLookup.cs` | Create |
| API | `Repositories/IPartnerRepository.cs`, `PartnerRepository.cs` | Create |
| API | `Controllers/PartnersController.cs` | Create |
| API | `Repositories/ILookupRepository.cs`, `LookupRepository.cs`, `Controllers/LookupsController.cs`, `Program.cs` | Modify |
| Tests | `PartnersControllerTests.cs`, `Infrastructure/FakePartnerRepository.cs` | Create |
| Tests | `Infrastructure/CmsApiFactory.cs`, `Infrastructure/FakeLookupRepository.cs` | Modify |
| NG | `core/models/partner.model.ts`, `core/services/partner.service.ts` (+ spec) | Create |
| NG | `core/models/lookup.model.ts`, `core/services/lookup.service.ts` (+ spec) | Modify |
| NG | `features/partners/partner-{list,detail,form}/*` (+ specs), `features/partners/testing/partner.fixtures.ts` | Create |
| NG | `app.routes.ts`, `app.ts` | Modify |

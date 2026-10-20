# Build Spec for Course
- database schema: .\database\course.sql

## Summary

`Course` is the central entity: a training course offered by a partner (原廠), with descriptive
content (objectives, outline, prerequisites…), a publish window (上架／下架日期), pricing and
learning credit. It references `Partner`, `CourseGroup` (optional) and `PublishStatus`, and has
N-N relations with `Certification` and `JobCategory`.

| Item | Detail |
|------|--------|
| Primary Key | `pkid` int IDENTITY |
| Foreign Keys | `Partner_pkid` → `Partner.pkid`; `CourseGroup_pkid` → `CourseGroup.pkid` (nullable); `PublishStatus_pkid` → `PublishStatus.pkid` |
| Required Fields | `Title`, `CourseId`, `ProdCourseId`, `FriendlyUrl`, `DisplayOrder`, `Partner_pkid`, `PublishStatus_pkid`, `ScheduleOn`, `ScheduleOff`, `Hour`, `ListPrice`, `LearningCredit`, `CanRepeat` |
| N-N Relationships | `CourseInCertification` (Course ↔ Certification), `CourseJobCategories` (Course ↔ JobCategory) — both `ON DELETE CASCADE` from Course |
| Primary-Foreign Links | `CourseFAQ`, `CourseRelatedLink`, `HotCourse` (`Course_pkid`, FK without cascade → block delete); `CourseRecomm` (`CourseId`, no FK constraint) — child features not built yet; links deferred |
| Query Filters | keyword (Title, OfficialTitle, CourseId, ProdCourseId, FriendlyUrl); Partner, CourseGroup, PublishStatus dropdowns; ScheduleOn / ScheduleOff date ranges; CanRepeat tri-state |
| Default Sort | `DisplayOrder ASC, pkid DESC` |

---

## Localization

### Chinese Table Name

- Course: 課程
- Description: 訓練課程主資料

### Chinese Column Names

Labels marked † come from the requested list-page columns.

- pkid: 主代碼 †
- Title: 課程名稱 †
- OfficialTitle: 官方課程名稱
- CourseId: 簡介代碼 †
- ProdCourseId: 科目代碼 †
- FriendlyUrl: 友善網址
- DisplayOrder: 顯示順序 †
- Partner_pkid: 原廠 †
- CourseGroup_pkid: 課程群組 †
- PublishStatus_pkid: 上架狀態 †
- ScheduleOn: 上架日期 †
- ScheduleOff: 下架日期 †
- Hour: 時數 †
- ListPrice: 定價 †
- LearningCredit: 點數 †
- Material: 教材
- Objective: 課程目標
- Target: 適合對象
- Prerequisites: 先備知識
- Outline: 課程大綱
- TowardCertOrExam: 考試／認證說明
- Note: 備註
- OtherInfo: 其他資訊
- CanRepeat: 允許重聽 †
- (N-N) Certifications: 相關認證
- (N-N) JobCategories: 職務類別

---

## Required Fields

Required (NOT NULL):
- `Title` nvarchar(200)
- `CourseId` varchar(50)
- `ProdCourseId` varchar(50)
- `FriendlyUrl` nvarchar(100)
- `DisplayOrder` int
- `Partner_pkid` smallint
- `PublishStatus_pkid` tinyint
- `ScheduleOn` date
- `ScheduleOff` date
- `Hour` smallint (DB default 0)
- `ListPrice` decimal(9,0) (DB default 0)
- `LearningCredit` decimal(9,1) (DB default 0)
- `CanRepeat` bit (DB default 0)

Optional (nullable):
- `OfficialTitle` nvarchar(300), `CourseGroup_pkid` smallint, `Material` nvarchar(500),
  `Objective` nvarchar(4000), `Target` nvarchar(500), `Prerequisites` nvarchar(4000),
  `Outline` nvarchar(max), `TowardCertOrExam` nvarchar(max), `Note` nvarchar(4000),
  `OtherInfo` nvarchar(4000)

Extra validation (not in DB): `ScheduleOff >= ScheduleOn`; `Hour`, `ListPrice`, `LearningCredit` ≥ 0.

---

## Foreign Keys

List and detail show the related row's label (JOIN), not the raw id. Form and filter drawer use
the lookup endpoints for options.

- **Partner_pkid** → `Partner.pkid` (required)
  - Label `Partner.Name`; order `DisplayOrder ASC, pkid ASC`
  - Nav object `Partner { pkid, name }` (multi-map)
- **CourseGroup_pkid** → `CourseGroup.pkid` (nullable — LEFT JOIN, "無" / clearable in form)
  - Label `CourseGroup.Description`; order `pkid ASC`
  - Nav object `CourseGroup { pkid, description } | null`
- **PublishStatus_pkid** → `PublishStatus.pkid` (required)
  - Label `PublishStatus.Description`; order `pkid ASC`
  - Nav object `PublishStatus { pkid, description }`

Invalid FK value on create/update (SQL 547) → **400** `原廠、課程群組或上架狀態不存在`.

---

## Foreign-Primary Links

In list, detail and form pages (form: small link icon next to the select when a value is chosen):

- **Partner_pkid** → `/partners/{partnerPkid}`
- **CourseGroup_pkid** → `/course-groups/{courseGroupPkid}` (only when not null)
- **PublishStatus_pkid** → `/publish-statuses/{publishStatusPkid}`

---

## Primary-Foreign Links

Tables referencing Course:

- **CourseFAQ** (`Course_pkid`) — 對應課程問答, `/course-faqs?coursePkid={pkid}`
- **CourseRelatedLink** (`Course_pkid`) — 對應相關連結, `/course-related-links?coursePkid={pkid}`
- **HotCourse** (`Course_pkid`) — 對應熱門課程, `/hot-courses?coursePkid={pkid}`
- **CourseRecomm** (`CourseId` / `RecommCourseId`, no FK) — 對應推薦課程

None of these features exist → **no link buttons generated now**.

Deleting a course referenced by CourseFAQ / CourseRelatedLink / HotCourse fails with SQL 547 →
**409** `課程「{CourseId}」已被使用，無法刪除`. N-N rows cascade automatically.

**Inbound links now enabled (Course exists):** add a 查看課程 button (`pi pi-book`) to the list
and detail pages of Partner, CourseGroup and PublishStatus, linking to
`/courses?partnerPkid=`, `/courses?courseGroupPkid=`, `/courses?publishStatusPkid=`.

---

## N-N Relationships

### CourseInCertification — Course ↔ Certification

- Junction: `CourseInCertification (Course_pkid int, Certification_pkid int)`
- Lookup: **new** `GET /api/lookups/certifications` → `{ pkid, title, partnerPkid, partnerName }`
  (`RTRIM(c.Title)` — nchar(100), nullable), ordered by `Partner.DisplayOrder, Partner.pkid, Title`
- Option label: `{partnerName} - {title}`
- Detail: list of certification labels (chips)
- Form: `p-multiselect` (`display="chip"`, `[maxSelectedLabels]="9999"`, filter)
- Request: `CertificationPkids: List<int>`

### CourseJobCategories — Course ↔ JobCategory

- Junction: `CourseJobCategories (Course_pkid int, JobCategory_pkid smallint)`
- Lookup: **new** `GET /api/lookups/job-categories` → `{ pkid, description }` ordered by `pkid`
- Detail: chips; Form: `p-multiselect`
- Request: `JobCategoryPkids: List<short>`

Sync (inside the INSERT/UPDATE transaction):
```sql
DELETE FROM CourseInCertification WHERE Course_pkid = @Pkid;
INSERT INTO CourseInCertification (Course_pkid, Certification_pkid) VALUES (@Pkid, @CertificationPkid); -- per id
DELETE FROM CourseJobCategories WHERE Course_pkid = @Pkid;
INSERT INTO CourseJobCategories (Course_pkid, JobCategory_pkid) VALUES (@Pkid, @JobCategoryPkid);     -- per id
```

GET by pkid loads both lists with separate queries on the same connection.

---

## Query Filters

- **keyword** — LIKE on `Title`, `OfficialTitle`, `CourseId`, `ProdCourseId`, `FriendlyUrl`
  (large text columns excluded)
- **PartnerPkid** (`short?`) — `c.Partner_pkid = @PartnerPkid`; `GET /api/lookups/partners`
- **CourseGroupPkid** (`short?`) — `c.CourseGroup_pkid = @CourseGroupPkid`; `GET /api/lookups/course-groups`
- **PublishStatusPkid** (`byte?`) — `c.PublishStatus_pkid = @PublishStatusPkid`; `GET /api/lookups/publish-statuses`
- **ScheduleOn** range — `ScheduleOnFrom` / `ScheduleOnTo` (inclusive)
- **ScheduleOff** range — `ScheduleOffFrom` / `ScheduleOffTo` (inclusive)
- **CanRepeat** (`bool?`) — null = all

---

## Lookup Endpoints Required

| Route | Status | Returns |
|-------|--------|---------|
| `GET /api/lookups/partners` | Exists | `{ pkid, name }[]` |
| `GET /api/lookups/course-groups` | Exists | `{ pkid, description }[]` |
| `GET /api/lookups/publish-statuses` | Exists | `{ pkid, description }[]` |
| `GET /api/lookups/certifications` | New | `{ pkid, title, partnerPkid, partnerName }[]` |
| `GET /api/lookups/job-categories` | New | `{ pkid, description }[]` |
| `GET /api/lookups/courses` | Not needed yet | (add when CourseFAQ / HotCourse are built) |

---

## API Endpoints

| Method | Route | Notes |
|--------|-------|-------|
| `GET` | `/api/courses` | List all (with FK nav objects) |
| `POST` | `/api/courses/query` | Filtered query (body: `CourseQuery`) |
| `GET` | `/api/courses/{id:int}` | Get by pkid, includes `certifications` / `jobCategories` |
| `POST` | `/api/courses` | Create → 201 + created entity; 400 on validation / bad FK |
| `PUT` | `/api/courses` | Update (pkid in body) → 204 / 404 / 400 |
| `DELETE` | `/api/courses/{id:int}` | Delete → 204 / 404 / **409** if referenced |

Not generated (from `sample1.spec.md`, out of scope for now): copy action, print PDF,
edit-mode sub-panels (CourseRelatedLink / CourseRecomm), ClassSection link (table not in schema).

---

## Backend Notes

### Models

```csharp
public class Course
{
    public int Pkid { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? OfficialTitle { get; set; }
    public string CourseId { get; set; } = string.Empty;
    public string ProdCourseId { get; set; } = string.Empty;
    public string FriendlyUrl { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public short PartnerPkid { get; set; }
    public short? CourseGroupPkid { get; set; }
    public byte PublishStatusPkid { get; set; }
    public DateOnly ScheduleOn { get; set; }
    public DateOnly ScheduleOff { get; set; }
    public short Hour { get; set; }
    public decimal ListPrice { get; set; }
    public decimal LearningCredit { get; set; }
    public string? Material { get; set; }
    public string? Objective { get; set; }
    public string? Target { get; set; }
    public string? Prerequisites { get; set; }
    public string? Outline { get; set; }
    public string? TowardCertOrExam { get; set; }
    public string? Note { get; set; }
    public string? OtherInfo { get; set; }
    public bool CanRepeat { get; set; }
    // FK nav objects (multi-map)
    public PartnerLookup? Partner { get; set; }
    public CourseGroupLookup? CourseGroup { get; set; }
    public PublishStatusLookup? PublishStatus { get; set; }
    // n-n, populated on GET by pkid
    public List<CertificationLookup> Certifications { get; set; } = [];
    public List<JobCategoryLookup> JobCategories { get; set; } = [];
}

public class CourseRequest : IValidatableObject   // ScheduleOff >= ScheduleOn
{
    public int Pkid { get; set; }                                   // ignored on create
    [Required, StringLength(200)] public string Title { get; set; } = string.Empty;
    [StringLength(300)]           public string? OfficialTitle { get; set; }
    [Required, StringLength(50)]  public string CourseId { get; set; } = string.Empty;
    [Required, StringLength(50)]  public string ProdCourseId { get; set; } = string.Empty;
    [Required, StringLength(100)] public string FriendlyUrl { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    [Range(1, short.MaxValue)]    public short PartnerPkid { get; set; }
    public short? CourseGroupPkid { get; set; }
    [Range(1, byte.MaxValue)]     public byte PublishStatusPkid { get; set; }
    [Required] public DateOnly? ScheduleOn { get; set; }
    [Required] public DateOnly? ScheduleOff { get; set; }
    [Range(0, short.MaxValue)]    public short Hour { get; set; }
    [Range(0, 999999999)]         public decimal ListPrice { get; set; }
    [Range(0, 99999999.9)]        public decimal LearningCredit { get; set; }
    [StringLength(500)]  public string? Material { get; set; }
    [StringLength(4000)] public string? Objective { get; set; }
    [StringLength(500)]  public string? Target { get; set; }
    [StringLength(4000)] public string? Prerequisites { get; set; }
    public string? Outline { get; set; }
    public string? TowardCertOrExam { get; set; }
    [StringLength(4000)] public string? Note { get; set; }
    [StringLength(4000)] public string? OtherInfo { get; set; }
    public bool CanRepeat { get; set; }
    public List<int> CertificationPkids { get; set; } = [];
    public List<short> JobCategoryPkids { get; set; } = [];
}

public class CourseQuery
{
    public string? Keyword { get; set; }
    public short? PartnerPkid { get; set; }
    public short? CourseGroupPkid { get; set; }
    public byte? PublishStatusPkid { get; set; }
    public DateOnly? ScheduleOnFrom { get; set; }
    public DateOnly? ScheduleOnTo { get; set; }
    public DateOnly? ScheduleOffFrom { get; set; }
    public DateOnly? ScheduleOffTo { get; set; }
    public bool? CanRepeat { get; set; }
}

public class CertificationLookup { public int Pkid; public string? Title; public short PartnerPkid; public string PartnerName; }
public class JobCategoryLookup   { public short Pkid; public string Description; }
```

`ScheduleOn` / `ScheduleOff` are nullable in the request only so a missing value yields 400
instead of defaulting to 0001-01-01.

### SQL — SELECT

```sql
SELECT c.pkid, c.Title, c.OfficialTitle, c.CourseId, c.ProdCourseId, c.FriendlyUrl, c.DisplayOrder,
       c.Partner_pkid AS PartnerPkid, c.CourseGroup_pkid AS CourseGroupPkid,
       c.PublishStatus_pkid AS PublishStatusPkid, c.ScheduleOn, c.ScheduleOff, c.Hour,
       c.ListPrice, c.LearningCredit, c.Material, c.Objective, c.Target, c.Prerequisites,
       c.Outline, c.TowardCertOrExam, c.Note, c.OtherInfo, c.CanRepeat,
       p.pkid, p.Name,
       cg.pkid, cg.Description,
       ps.pkid, ps.Description
FROM Course c
INNER JOIN Partner p ON p.pkid = c.Partner_pkid
LEFT JOIN CourseGroup cg ON cg.pkid = c.CourseGroup_pkid
INNER JOIN PublishStatus ps ON ps.pkid = c.PublishStatus_pkid
ORDER BY c.DisplayOrder ASC, c.pkid DESC
```

Multi-map `<Course, PartnerLookup, CourseGroupLookup, PublishStatusLookup, Course>` with
`splitOn: "pkid,pkid,pkid"` (null `CourseGroup` when LEFT JOIN misses).

N-N reads (GET by pkid):
```sql
SELECT c.pkid, RTRIM(c.Title) AS Title, c.Partner_pkid AS PartnerPkid, p.Name AS PartnerName
FROM CourseInCertification ci
INNER JOIN Certification c ON c.pkid = ci.Certification_pkid
INNER JOIN Partner p ON p.pkid = c.Partner_pkid
WHERE ci.Course_pkid = @pkid
ORDER BY p.DisplayOrder, p.pkid, c.Title;

SELECT j.pkid, j.Description
FROM CourseJobCategories cj INNER JOIN JobCategory j ON j.pkid = cj.JobCategory_pkid
WHERE cj.Course_pkid = @pkid ORDER BY j.pkid;
```

### SQL — INSERT

```sql
INSERT INTO Course (Title, OfficialTitle, CourseId, ProdCourseId, FriendlyUrl, DisplayOrder,
    Partner_pkid, CourseGroup_pkid, PublishStatus_pkid, ScheduleOn, ScheduleOff, Hour,
    ListPrice, LearningCredit, Material, Objective, Target, Prerequisites, Outline,
    TowardCertOrExam, Note, OtherInfo, CanRepeat)
VALUES (@Title, @OfficialTitle, @CourseId, @ProdCourseId, @FriendlyUrl, @DisplayOrder,
    @PartnerPkid, @CourseGroupPkid, @PublishStatusPkid, @ScheduleOn, @ScheduleOff, @Hour,
    @ListPrice, @LearningCredit, @Material, @Objective, @Target, @Prerequisites, @Outline,
    @TowardCertOrExam, @Note, @OtherInfo, @CanRepeat);
SELECT CAST(SCOPE_IDENTITY() AS int);
```

### SQL — UPDATE

Same writable columns, `WHERE pkid = @Pkid`; returns false (→ 404) when 0 rows.

### SQL — DELETE

`DELETE FROM Course WHERE pkid = @pkid` (N-N cascade); SQL 547 → `ReferenceConflictException` → 409.

### Special Column Notes

- `date` columns → `DateOnly` (handlers already registered via `DapperConfig`).
- `Certification.Title` is `nchar(100)` → `RTRIM()` in every SELECT.
- `Partner_pkid` etc. aliased to `PartnerPkid` etc.
- Strings trimmed on save; blank optional strings stored as NULL; `CourseGroupPkid` 0 → NULL.
- Duplicate ids in N-N lists are de-duplicated before insert.
- RowAudit: no `RowAuditWriter` / `RowAuditBadgeComponent` exists yet — skipped (same as previous features).

---

## Frontend Notes

### Routes

| Path | Component | Title |
|------|-----------|-------|
| `/courses` | `CourseList` | 課程 Course |
| `/courses/new` | `CourseForm` | 新增課程 |
| `/courses/:id` | `CourseDetail` | 檢視課程 |
| `/courses/:id/edit` | `CourseForm` | 編輯課程 |

### Model (`core/models/course.model.ts`)

```ts
export interface Course {
  pkid: number; title: string; officialTitle: string | null; courseId: string; prodCourseId: string;
  friendlyUrl: string; displayOrder: number; partnerPkid: number; courseGroupPkid: number | null;
  publishStatusPkid: number; scheduleOn: string; scheduleOff: string; // 'yyyy-MM-dd'
  hour: number; listPrice: number; learningCredit: number; material: string | null;
  objective: string | null; target: string | null; prerequisites: string | null;
  outline: string | null; towardCertOrExam: string | null; note: string | null;
  otherInfo: string | null; canRepeat: boolean;
  partner: PartnerLookup | null; courseGroup: CourseGroupLookup | null;
  publishStatus: PublishStatusLookup | null;
  certifications: CertificationLookup[]; jobCategories: JobCategoryLookup[];
}
export interface CourseRequest { /* scalar fields */ certificationPkids: number[]; jobCategoryPkids: number[]; }
export interface CourseQuery { keyword?, partnerPkid?, courseGroupPkid?, publishStatusPkid?,
  scheduleOnFrom?, scheduleOnTo?, scheduleOffFrom?, scheduleOffTo?, canRepeat? }
```

### List

Columns (in this order, all sortable):

| Header | Field | Notes |
|--------|-------|-------|
| 主代碼 | `pkid` | |
| 顯示順序 | `displayOrder` | centered |
| 簡介代碼 | `courseId` | |
| 科目代碼 | `prodCourseId` | |
| 課程名稱 | `title` | plain text (inline-editable; 檢視 button opens detail) |
| 原廠 | `partner.name` | link `/partners/{partnerPkid}` |
| 課程群組 | `courseGroup.description` | link `/course-groups/{courseGroupPkid}`; `—` when null |
| 上架狀態 | `publishStatus.description` | plain text in list (inline-editable); linked in detail |
| 上架日期 | `scheduleOn` | `yyyy-MM-dd` |
| 下架日期 | `scheduleOff` | `yyyy-MM-dd` |
| 時數 | `hour` | right-aligned |
| 定價 | `listPrice` | right-aligned, thousands separator |
| 點數 | `learningCredit` | right-aligned, 1 decimal |
| 允許重聽 | `canRepeat` | check / dash icon |
| 操作 | — | view / edit / delete |

- Default sort `displayOrder` ASC (server: `DisplayOrder ASC, pkid DESC`).
- Filter drawer: 關鍵字; 原廠 / 課程群組 / 上架狀態 (`p-select`, `appendTo="body"`, clearable,
  `[filter]` when ≥ 10 options); 上架日期 起～迄 and 下架日期 起～迄 (`p-datepicker`,
  `dataType="string"`, `dateFormat="yy-mm-dd"` so filters stay `yyyy-MM-dd` strings in session);
  允許重聽 (`p-select` 全部／是／否).
- Lookups loaded with `forkJoin`; saved filters restored after they load.
- Query params `partnerPkid`, `courseGroupPkid`, `publishStatusPkid` (from Partner / CourseGroup /
  PublishStatus pages) override saved filters: filters reset to empty + that FK.

### List — Inline Edit

Pattern: `spec/inline-edit.md`. Double-click a cell to edit; blur saves.

| Column | Editor | Validation |
|--------|--------|------------|
| 顯示順序 | `p-inputnumber` (integer) | required integer |
| 簡介代碼 / 科目代碼 | `pInputText` | required (not blank), ≤ 50 |
| 課程名稱 | `pInputText` | required (not blank), ≤ 200 |
| 上架狀態 | `p-select` (`publishStatusOptions`) | required |
| 上架日期 / 下架日期 | `p-datepicker` (`dataType="string"`) | required, valid `yyyy-MM-dd`, 上架日期 ≤ 下架日期 |
| 時數 | `p-inputnumber` | integer 0–32767 |
| 定價 | `p-inputnumber` | integer 0–999999999 |
| 點數 | `p-inputnumber` (1 decimal) | 0–99999999.9 |
| 允許重聽 | `p-checkbox` (binary) | — |

- Read-only: 主代碼, 原廠, 課程群組 (no `data-field`).
- Save = `GET /api/courses/{pkid}` then `PUT /api/courses` with that record + the edited field.
  List rows have empty n-n, and PUT re-syncs n-n, so PUTting the row would wipe them.
- Text values are trimmed; unchanged value → no request. Success toast 已更新; failure reverts the
  cell and toasts 更新失敗.

### Detail

- Card 基本資料: all scalar fields; FK labels linked; long text `pre-wrap`; `—` for nulls.
- Card 相關認證 / 職務類別: chips (or 「無」).
- Toolbar: 返回, 刪除, 編輯.

### Detail — QR Code

Component `features/courses/course-qr-code/` (`<app-course-qr-code [pkid] [courseId]>`), placed in
the 基本資料 card to the right of the field grid (stacked below it at ≤ 768px). Generated
client-side on load with the `qrcode` npm package (listed in `angular.json`
`allowedCommonJsDependencies`); no API involved.

| Item | Value |
|------|-------|
| Encoded URL | `https://www.uuu.com.tw/Course/Show/{pkid}/{CourseId}` — exported `courseQrUrl()`; CourseId trimmed (nchar padding) and `encodeURIComponent`-ed |
| Title | CourseId (trimmed), drawn above the code; bold sans-serif 22px, shrunk to fit width (min 9px) |
| Error correction | `M` |
| Canvas layout | 6px per module, 4-module white quiet zone, 44px title band on top; white background, black modules. Size = `(modules + 8) × 6` wide, `+ 44` high (e.g. 246×290 for a 33-module code) |
| Below canvas | URL as a link (new tab), then button 下載 QR Code (`pi pi-download`, secondary, outlined, small) |
| Download | `canvas.toBlob('image/png')` → object URL → `<a download>` click → revoke. File name `{CourseId}-QRCode.png`; `\ / : * ? " < > \|` and whitespace → `_`; falls back to pkid if CourseId is blank |
| Accessibility | canvas `role="img"`, `aria-label="QR Code：{CourseId}"` |

The canvas (title + code) is drawn module-by-module from `QRCode.create()` in an
`afterRenderEffect`, so the on-screen image and the downloaded PNG are identical and redraw when
the inputs change.

### Form

Panels: 基本資料, 上架設定, 課程內容, 關聯.

Toolbar (title + 取消 / 儲存, same in New and Edit): `.page-header.form-toolbar` (global rule in `styles.scss`, shared by all page forms) is `position: sticky; top: 0; z-index: 10` with a light shadow, so it stays pinned at the top of the content column while the form body scrolls (the page scrolls at document level; no top app bar, sidebar is a separate column).

| Field | Widget | Rules |
|-------|--------|-------|
| pkid | read-only input (edit only) | |
| title | `pInputText` | required, max 200 |
| officialTitle | `pInputText` | max 300 |
| courseId | `pInputText` | required, max 50 |
| prodCourseId | `pInputText` | required, max 50 |
| friendlyUrl | `pInputText` | required, max 100 |
| displayOrder | `p-inputnumber` | required, default 0 |
| partnerPkid | `p-select` | required |
| courseGroupPkid | `p-select` clearable | optional |
| publishStatusPkid | `p-select` | required |
| scheduleOn | `p-datepicker` | required, default today |
| scheduleOff | `p-datepicker` | required, ≥ scheduleOn, default scheduleOn + 10 years |
| hour | `p-inputnumber` | required, min 0 |
| listPrice | `p-inputnumber` | required, min 0, integer |
| learningCredit | `p-inputnumber` | required, min 0, 1 decimal |
| canRepeat | `p-checkbox` binary | |
| material, target | `pInputText` | max 500 |
| objective, prerequisites, note, otherInfo | `p-textarea` | max 4000 |
| outline, towardCertOrExam | `p-textarea` | no max |
| certificationPkids | `p-multiselect` chips | |
| jobCategoryPkids | `p-multiselect` chips | |

- `forkJoin` of five lookups (+ course in edit mode).
- `scheduleOn.valueChanges` → set `scheduleOff = addYears(on, 10)` with `{ emitEvent: false }`;
  edit-mode `patchValue` sets `scheduleOff` after `scheduleOn` so the loaded value wins.
- Dates: new `core/utils/date.util.ts` (`toIsoDate`, `parseIsoDate`, `addYears`) using local components.
- Header toolbar (sticky like other forms) 取消 / 儲存; after create, navigate to the new detail.

### Delete Confirmation

```
確定要刪除主代碼 <b>${item.pkid}</b>「${escapeHtml(item.title)}」？
```

### Session Storage Keys

| Key | Contents |
|-----|----------|
| `course-list-filters` | Last query filter values |
| `course-list-sort` | `{ sortField, sortOrder }` |
| `course-list-page` | `{ first, rows }` |

### Sidebar

Existing group **課程管理 Course** → add `課程 Course` (`pi pi-graduation-cap`, `/courses`) as the first item.

---

## Tests

### Backend (`CMS.API.Tests`)

- `Infrastructure/FakeCourseRepository.cs` — 3 seeded courses resolving nav objects from the
  Partner / CourseGroup / PublishStatus fakes; seeded certifications + job categories; pkid 1
  marked "in use"; unknown FK → `InvalidReferenceException`.
- `FakeLookupRepository` gains certifications / job categories; `CmsApiFactory` registers the fake.
- `CoursesControllerTests.cs`: GetAll sorted + nav objects; query by keyword (each column), each FK,
  date ranges, canRepeat, combined, no match; get found (with n-n) / 404; create 201 (trim, blank →
  null, n-n saved, Location) / missing required → 400 / too long → 400 / ScheduleOff < ScheduleOn →
  400 / unknown FK → 400; update 204 / 404 / 400; delete 204 / 404 / in-use 409; new lookups.

### Frontend

- `core/utils/date.util.spec.ts`
- `course.service.spec.ts`; `lookup.service.spec.ts` (new methods)
- `course-list.spec.ts`, `course-detail.spec.ts`, `course-form.spec.ts`
- `course-list.spec.ts` inline edit: double-click (not click) opens the editor; 主代碼 / 原廠 /
  課程群組 read-only; editor type per column; blur → GET + PUT with n-n kept; unchanged → no PUT;
  focus inside cell / overlay doesn't commit; real datepicker / select overlay pick then blur
  saves; Escape cancels; validation (required, ≥ 0, integer,
  valid dates, 上架日期 ≤ 下架日期) keeps the cell open; failed GET / PUT reverts + error toast.
- `course-qr-code.spec.ts`: `courseQrUrl()` (trim + encoding); module matrix equals
  `QRCode.create(expectedUrl)` and matches the canvas pixels; title = CourseId drawn in the title
  band; download yields a PNG blob (signature + same size as canvas) named `{CourseId}-QRCode.png`;
  file-name sanitising; button triggers download. `course-detail.spec.ts`: QR code sits in the
  基本資料 panel with the record's URL.
- Partner / CourseGroup / PublishStatus list + detail specs updated for the 查看課程 link.

---

## Files to Create / Modify

| Area | File | Action |
|------|------|--------|
| API | `Models/Course.cs`, `CourseRequest.cs`, `CourseQuery.cs`, `CertificationLookup.cs`, `JobCategoryLookup.cs` | Create |
| API | `Repositories/ICourseRepository.cs`, `CourseRepository.cs`, `InvalidReferenceException.cs` | Create |
| API | `Controllers/CoursesController.cs` | Create |
| API | `Repositories/ILookupRepository.cs`, `LookupRepository.cs`, `Controllers/LookupsController.cs`, `Program.cs` | Modify |
| Tests | `CoursesControllerTests.cs`, `Infrastructure/FakeCourseRepository.cs` | Create |
| Tests | `Infrastructure/CmsApiFactory.cs`, `Infrastructure/FakeLookupRepository.cs` | Modify |
| NG | `core/models/course.model.ts`, `core/services/course.service.ts` (+ spec), `core/utils/date.util.ts` (+ spec) | Create |
| NG | `core/models/lookup.model.ts`, `core/services/lookup.service.ts` (+ spec) | Modify |
| NG | `features/courses/course-{list,detail,form}/*` (+ specs), `features/courses/testing/course.fixtures.ts` | Create |
| NG | `features/courses/course-qr-code/*` (+ spec) | Create |
| NG | `package.json` (`qrcode`, `@types/qrcode`), `angular.json` (`allowedCommonJsDependencies`) | Modify |
| NG | `app.routes.ts`, `app.ts` (+ `app.spec.ts`) | Modify |
| NG | Partner / CourseGroup / PublishStatus list + detail (查看課程 link) | Modify |
| Docs | `docs/setup-notes.md`, `src/README.md` | Modify |

# Setup notes

Reference context for CLAUDE.md: layout, environment, tooling gotchas, git, features and change log. Code rules live in `docs/conventions.md`.

## Layout

| Path | Contents |
|------|----------|
| `database/*.sql` | SQL Server schema scripts per sub-system (`admin`, `auth`, `course`, `promotion`). Source of truth for tables/columns. |
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
- No Python on this machine; use PowerShell/Node for scripting.

## Git

- Remote `origin` = https://github.com/ying0515/cms-1019 (public).
- Branches: `develop` (GitHub default, day-to-day work) and `main`.
- Commit identity is set repo-locally (`git config user.name/user.email`).

## Pending

- `spec/feature-spec.template.md` references `spec/dapper.md` and `spec/inline-edit.md`, which **do not exist yet** (`core/utils/date.util.ts` now exists) — create them when the first feature needs them.

## Implemented features

| Feature | Backend | Frontend routes |
|---------|---------|-----------------|
| AppUser (系統管理 Admin › 使用者) | `AppUsersController`, `AppUserRepository`, `SysConfigRepository`; n-n roles via `AppUserRole`; backend-only PasswordHash (SHA-256 of `SysConfig` appConfig `defaultPassword`); `POST /api/app-users/{id}/reset-password`; `GET /api/lookups/app-roles` | `/app-users`, `/app-users/new`, `/app-users/:id`, `/app-users/:id/edit` |
| AppRole (系統管理 Admin › 角色) | `AppRolesController`, `AppRoleRepository`; n-n users via `AppUserRole`; `GET /api/lookups/app-users` | `/app-roles` (accepts `?userId=`), `/app-roles/new`, `/app-roles/:id`, `/app-roles/:id/edit` |
| PublishStatus (系統管理 Admin › 發布狀態) | `PublishStatusesController`, `PublishStatusRepository`; user-supplied tinyint pkid; delete → 409 via `ReferenceConflictException` (SQL 547); `GET /api/lookups/publish-statuses` | `/publish-statuses`, `/publish-statuses/new`, `/publish-statuses/:id`, `/publish-statuses/:id/edit` |
| Partner (課程管理 Course › 合作廠商) | `PartnersController`, `PartnerRepository`; smallint IDENTITY pkid; delete → 409 via `ReferenceConflictException`; `GET /api/lookups/partners` | `/partners`, `/partners/new`, `/partners/:id`, `/partners/:id/edit` |
| CourseGroup (課程管理 Course › 課程群組) | `CourseGroupsController`, `CourseGroupRepository`; smallint IDENTITY pkid; delete → 409 via `ReferenceConflictException`; `GET /api/lookups/course-groups` | `/course-groups`, `/course-groups/new`, `/course-groups/:id`, `/course-groups/:id/edit` |
| Course (課程管理 Course › 課程) | `CoursesController`, `CourseRepository`; multi-map FK nav objects; n-n `CourseInCertification` / `CourseJobCategories`; bad FK → 400 via `InvalidReferenceException`; delete → 409; `GET /api/lookups/certifications`, `/job-categories` | `/courses`, `/courses/new`, `/courses/:id`, `/courses/:id/edit` (accepts `?partnerPkid=`, `?courseGroupPkid=`, `?publishStatusPkid=`) |
| FeaturedPromoItem (首頁 Home › 上稿作業) | `FeaturedPromoItemsController`, `FeaturedPromoItemRepository`; query by `trainingCenterPkid` + `weekOf` (Mon–Sun); UNIQUE date/center/slot → 409 via `DuplicateKeyException`; `POST /{id}/move-up`, `/move-down` swap slots in one UPDATE; `GET /api/lookups/training-centers`, `/promotions?keyword=` | `/featured-promo-items` only — single weekly-schedule page with inline Edit/New/Paste form (no detail/new routes) |

## Change log

Newest first, one dated line per meaningful change.

- 2026-10-20 — Documented the Course QR code in `spec/course/Course.md` (new *Detail — QR Code* section: URL, title, canvas layout, download naming; tests and files tables updated).
- 2026-10-20 — Added `database/refresh-promo-dates.sql`: dev-data helper that shifts all `FeaturedPromoItem.ScheduleOn` dates so the newest is ~30 days from today (keeps relative spacing), so the weekly schedule page has rows to show.
- 2026-10-20 — Added QR code to Course detail 基本資料 panel: new `features/courses/course-qr-code` component (`qrcode` npm package, allowed as CommonJS in `angular.json`) encodes `https://www.uuu.com.tw/Course/Show/{pkid}/{CourseId}` (CourseId trimmed + URI-encoded), draws CourseId as a title above the code on one canvas, and 下載 QR Code saves it as `{CourseId}-QRCode.png`. Tests: `course-qr-code.spec.ts` (URL, module matrix vs canvas pixels, title, PNG download) + detail spec.
- 2026-10-20 — Added FeaturedPromoItem custom CRUD (spec `spec/custom/FeaturedPromoItem/`): weekly schedule page (TrainingCenter tabs, Mon–Sun week navigator, slots 1–3 per day) with inline Edit/New form, PromoCode autocomplete (`GET /api/lookups/promotions`, prefills Topic/Description), +/− slot swap endpoints, Copy/Paste, Delete; new lookup `training-centers`, `DuplicateKeyException` (SQL 2627/2601 → 409), `addDays`/`startOfWeek` in `date.util.ts`. New sidebar group 首頁 Home (first). Tests: `FeaturedPromoItemsControllerTests`, list/form/service specs.

- 2026-10-19 — Re-organized CLAUDE.md into always-needed rules plus a "read when needed" index; code rules moved to new `docs/conventions.md`; tooling gotchas (locked `bin/`, `sqlcmd -C`, no Python) added here.
- 2026-10-19 — Added AppUser CRUD (spec `spec/auth/AppUser.md`): API with n-n Roles, keyword / IsActive / RoleId filters, new lookup `app-roles`; PasswordHash never leaves the backend — set on create and by new `POST /api/app-users/{id}/reset-password` from `SysConfig` appConfig `defaultPassword` (SHA-256, lowercase hex); new `ISysConfigRepository` + `Data/PasswordHasher`. Angular list/detail/form under 系統管理 Admin (detail has 重設密碼 and 查看角色); AppRole list now accepts `?userId=`.
- 2026-10-19 — Added Course CRUD (spec `spec/course/Course.md`): API with JOINed Partner/CourseGroup/PublishStatus nav objects, n-n Certifications/JobCategories, date-range + FK + CanRepeat filters, new lookups `certifications` / `job-categories`; Angular list/detail/form under 課程管理 Course; new `core/utils/date.util.ts`. Partner / CourseGroup / PublishStatus list + detail gained 查看課程 buttons. Copy, QR, print and sub-panels from `sample1.spec.md` deferred.
- 2026-10-19 — Added CourseGroup CRUD (spec `spec/course/CourseGroup.md`): API + `GET /api/lookups/course-groups`, Angular list/detail/form under 課程管理 Course. Course/PartnerCourseGroup link buttons deferred until those features exist.
- 2026-10-19 — Added Partner CRUD (spec `spec/course/Partner.md`): API + `GET /api/lookups/partners`, Angular list/detail/form, new sidebar group 課程管理 Course. Course/Certification/PartnerCourseGroup/Promotion2 link buttons deferred until those features exist.
- 2026-10-19 — Added PublishStatus CRUD (spec `spec/admin/PublishStatus.md`): API + lookup endpoint, Angular list/detail/form, sidebar entry. Tests now fake `ILookupRepository` too (`FakeLookupRepository`). Course/Promotion2 link buttons deferred until those features exist.

- 2026-10-19 — Trimmed CLAUDE.md under 2K chars; moved layout, environment, git, features and change log here.
- 2026-10-19 — Created `develop` from `main` and made it the GitHub default branch.
- 2026-10-19 — Initialized git repo and pushed to GitHub (`ying0515/cms-1019`).
- 2026-10-19 — Added CLAUDE.md. Current state: AppRole feature (API + tests + Angular list/detail/form with specs); list page filter drawer (keyword, permission-level range, user) with session-persisted filters/sort/page.

# Setup notes

Reference and one-time context moved out of `CLAUDE.md`.

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

## Git

- Remote `origin` = https://github.com/ying0515/cms-1019 (public).
- Branches: `develop` (GitHub default, day-to-day work) and `main`.
- Commit identity is set repo-locally (`git config user.name/user.email`).

## Pending

- `spec/feature-spec.template.md` references `spec/dapper.md` and `spec/inline-edit.md`, which **do not exist yet** (`core/utils/date.util.ts` now exists) — create them when the first feature needs them.

## Implemented features

| Feature | Backend | Frontend routes |
|---------|---------|-----------------|
| AppRole (系統管理 Admin › 角色) | `AppRolesController`, `AppRoleRepository`; n-n users via `AppUserRole`; `GET /api/lookups/app-users` | `/app-roles`, `/app-roles/new`, `/app-roles/:id`, `/app-roles/:id/edit` |
| PublishStatus (系統管理 Admin › 發布狀態) | `PublishStatusesController`, `PublishStatusRepository`; user-supplied tinyint pkid; delete → 409 via `ReferenceConflictException` (SQL 547); `GET /api/lookups/publish-statuses` | `/publish-statuses`, `/publish-statuses/new`, `/publish-statuses/:id`, `/publish-statuses/:id/edit` |
| Partner (課程管理 Course › 合作廠商) | `PartnersController`, `PartnerRepository`; smallint IDENTITY pkid; delete → 409 via `ReferenceConflictException`; `GET /api/lookups/partners` | `/partners`, `/partners/new`, `/partners/:id`, `/partners/:id/edit` |
| CourseGroup (課程管理 Course › 課程群組) | `CourseGroupsController`, `CourseGroupRepository`; smallint IDENTITY pkid; delete → 409 via `ReferenceConflictException`; `GET /api/lookups/course-groups` | `/course-groups`, `/course-groups/new`, `/course-groups/:id`, `/course-groups/:id/edit` |
| Course (課程管理 Course › 課程) | `CoursesController`, `CourseRepository`; multi-map FK nav objects; n-n `CourseInCertification` / `CourseJobCategories`; bad FK → 400 via `InvalidReferenceException`; delete → 409; `GET /api/lookups/certifications`, `/job-categories` | `/courses`, `/courses/new`, `/courses/:id`, `/courses/:id/edit` (accepts `?partnerPkid=`, `?courseGroupPkid=`, `?publishStatusPkid=`) |

## Change log

Newest first, one dated line per meaningful change.

- 2026-10-19 — Added Course CRUD (spec `spec/course/Course.md`): API with JOINed Partner/CourseGroup/PublishStatus nav objects, n-n Certifications/JobCategories, date-range + FK + CanRepeat filters, new lookups `certifications` / `job-categories`; Angular list/detail/form under 課程管理 Course; new `core/utils/date.util.ts`. Partner / CourseGroup / PublishStatus list + detail gained 查看課程 buttons. Copy, QR, print and sub-panels from `sample1.spec.md` deferred.
- 2026-10-19 — Added CourseGroup CRUD (spec `spec/course/CourseGroup.md`): API + `GET /api/lookups/course-groups`, Angular list/detail/form under 課程管理 Course. Course/PartnerCourseGroup link buttons deferred until those features exist.
- 2026-10-19 — Added Partner CRUD (spec `spec/course/Partner.md`): API + `GET /api/lookups/partners`, Angular list/detail/form, new sidebar group 課程管理 Course. Course/Certification/PartnerCourseGroup/Promotion2 link buttons deferred until those features exist.
- 2026-10-19 — Added PublishStatus CRUD (spec `spec/admin/PublishStatus.md`): API + lookup endpoint, Angular list/detail/form, sidebar entry. Tests now fake `ILookupRepository` too (`FakeLookupRepository`). Course/Promotion2 link buttons deferred until those features exist.

- 2026-10-19 — Trimmed CLAUDE.md under 2K chars; moved layout, environment, git, features and change log here.
- 2026-10-19 — Created `develop` from `main` and made it the GitHub default branch.
- 2026-10-19 — Initialized git repo and pushed to GitHub (`ying0515/cms-1019`).
- 2026-10-19 — Added CLAUDE.md. Current state: AppRole feature (API + tests + Angular list/detail/form with specs); list page filter drawer (keyword, permission-level range, user) with session-persisted filters/sort/page.

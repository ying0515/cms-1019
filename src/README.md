# CMS

| Project | Stack | Local URL |
|---------|-------|-----------|
| `CMS.API` | .NET 9 Web API, Dapper, Swashbuckle 7.2.0 | http://localhost:5000 (Swagger: `/swagger`) |
| `CMS.API.Tests` | xUnit + `WebApplicationFactory` | — |
| `CMS.NG` | Angular 20 (standalone), PrimeNG 20 | http://localhost:4200 |

Database: SQL Server Express `.\SQLEXPRESS`, database `CMS` (schemas in `..\database\*.sql`).
The connection string is in `CMS.API/appsettings.json` under `ConnectionStrings:CMS`.

## Run

```powershell
# API
cd src\CMS.API
dotnet run            # http://localhost:5000/swagger

# Frontend
cd src\CMS.NG
npm install
npm start             # http://localhost:4200
```

The frontend calls the API directly (no dev proxy). The API base URL is set in
`CMS.NG/src/environments/environment*.ts`, and code imports it as `@env/environment`.
The API allows CORS from any loopback origin (`localhost`, `127.0.0.1`).

## Test

```powershell
cd src
dotnet test                       # backend (in-memory fake repository, no DB required)

cd CMS.NG
npm test                          # Karma + Jasmine (ng test)
npx ng test --watch=false --browsers=ChromeHeadless   # CI / single run
```

## Features

### AppUser (`系統管理 Admin › 使用者 AppUser`)

| Method | Route | Description |
|--------|-------|-------------|
| GET    | `/api/app-users` | All users (with `roleCount`) |
| POST   | `/api/app-users/query` | Filter: `keyword` (UserId/UserName), `isActive`, `roleId` |
| GET    | `/api/app-users/{pkid}` | Single user, including assigned `roles` |
| POST   | `/api/app-users` | Create (`409` if UserId exists; `500` if the default password is not configured) |
| PUT    | `/api/app-users` | Update (pkid in body; UserId and PasswordHash are not changed) |
| POST   | `/api/app-users/{pkid}/reset-password` | No body; resets PasswordHash to the default password |
| DELETE | `/api/app-users/{pkid}` | Delete (also removes its `AppUserRole` rows) |
| GET    | `/api/lookups/app-roles` | AppRole lookup for the role picker |

`PasswordHash` is backend-only: it is never in a request, response or Angular model. On create and reset-password it is set to the lowercase-hex SHA-256 of `defaultPassword` from the JSON in `SysConfig` (`configKey = 'appConfig'`), and `PasswordUpdatedTime` is set to `GETUTCDATE()`.

Frontend routes: `/app-users` (list), `/app-users/new`, `/app-users/:id` (view), `/app-users/:id/edit`.
The list keeps its filters, sort and page in sessionStorage (`app-user-list-filters`, `app-user-list-sort`, `app-user-list-page`). 查看角色 opens `/app-roles?userId={userId}`.

### AppRole (`系統管理 Admin › 角色 AppRole`)

| Method | Route | Description |
|--------|-------|-------------|
| GET    | `/api/app-roles` | All roles (with `userCount`) |
| POST   | `/api/app-roles/query` | Filter: `keyword` (RoleId/RoleName/Description), `permissionLevelFrom/To`, `userId` |
| GET    | `/api/app-roles/{pkid}` | Single role, including assigned `users` |
| POST   | `/api/app-roles` | Create (`409` if RoleId exists) |
| PUT    | `/api/app-roles` | Update (pkid in body; RoleId is the table PK and cannot be changed) |
| DELETE | `/api/app-roles/{pkid}` | Delete (also removes its `AppUserRole` rows) |
| GET    | `/api/lookups/app-users` | AppUser lookup for the user picker |

User assignment (`AppUserRole`, n-n keyed by `UserId`/`RoleId`) is saved by delete-then-reinsert in the same transaction.

Frontend routes: `/app-roles` (list), `/app-roles/new`, `/app-roles/:id` (view), `/app-roles/:id/edit`.
The list keeps its filters, sort and page in sessionStorage (`app-role-list-filters`, `app-role-list-sort`, `app-role-list-page`).

### PublishStatus (`系統管理 Admin › 發布狀態 PublishStatus`)

| Method | Route | Description |
|--------|-------|-------------|
| GET    | `/api/publish-statuses` | All statuses, ordered by pkid |
| POST   | `/api/publish-statuses/query` | Filter: `keyword` (Description), `isDraft`, `isPublished`, `isDiscontinued` |
| GET    | `/api/publish-statuses/{pkid}` | Single status |
| POST   | `/api/publish-statuses` | Create; pkid is user-supplied tinyint (`409` if it exists) |
| PUT    | `/api/publish-statuses` | Update (pkid in body; pkid cannot be changed) |
| DELETE | `/api/publish-statuses/{pkid}` | Delete (`409` if referenced by `Course` / `Promotion2`) |
| GET    | `/api/lookups/publish-statuses` | `{ pkid, description }` lookup for FK dropdowns |

Frontend routes: `/publish-statuses` (list), `/publish-statuses/new`, `/publish-statuses/:id` (view), `/publish-statuses/:id/edit`.
The list keeps its filters, sort and page in sessionStorage (`publish-status-list-filters`, `publish-status-list-sort`, `publish-status-list-page`).

### Partner (`課程管理 Course › 合作廠商 Partner`)

| Method | Route | Description |
|--------|-------|-------------|
| GET    | `/api/partners` | All partners, ordered by DisplayOrder ASC, pkid DESC |
| POST   | `/api/partners/query` | Filter: `keyword` (Name, AppKey, NameOnPartnerMenu, NameOnCourseDetailPage, ImageFilename) |
| GET    | `/api/partners/{pkid}` | Single partner |
| POST   | `/api/partners` | Create; pkid is smallint IDENTITY (body pkid ignored) |
| PUT    | `/api/partners` | Update (pkid in body) |
| DELETE | `/api/partners/{pkid}` | Delete (`409` if referenced by `Course` / `Certification` / `PartnerCourseGroup` / `Promotion2`) |
| GET    | `/api/lookups/partners` | `{ pkid, name }` lookup for FK dropdowns, ordered by DisplayOrder |

Frontend routes: `/partners` (list), `/partners/new`, `/partners/:id` (view), `/partners/:id/edit`.
The list keeps its filters, sort and page in sessionStorage (`partner-list-filters`, `partner-list-sort`, `partner-list-page`).

### CourseGroup (`課程管理 Course › 課程群組 CourseGroup`)

| Method | Route | Description |
|--------|-------|-------------|
| GET    | `/api/course-groups` | All groups, ordered by pkid DESC |
| POST   | `/api/course-groups/query` | Filter: `keyword` (Description) |
| GET    | `/api/course-groups/{pkid}` | Single group |
| POST   | `/api/course-groups` | Create; pkid is smallint IDENTITY (body pkid ignored) |
| PUT    | `/api/course-groups` | Update (pkid in body) |
| DELETE | `/api/course-groups/{pkid}` | Delete (`409` if referenced by `Course` / `PartnerCourseGroup`) |
| GET    | `/api/lookups/course-groups` | `{ pkid, description }` lookup for FK dropdowns, ordered by pkid |

Frontend routes: `/course-groups` (list), `/course-groups/new`, `/course-groups/:id` (view), `/course-groups/:id/edit`.
The list keeps its filters, sort and page in sessionStorage (`course-group-list-filters`, `course-group-list-sort`, `course-group-list-page`).

### Course (`課程管理 Course › 課程 Course`)

| Method | Route | Description |
|--------|-------|-------------|
| GET    | `/api/courses` | All courses with `partner` / `courseGroup` / `publishStatus` nav objects, ordered by DisplayOrder ASC, pkid DESC |
| POST   | `/api/courses/query` | Filters: `keyword` (Title, OfficialTitle, CourseId, ProdCourseId, FriendlyUrl), `partnerPkid`, `courseGroupPkid`, `publishStatusPkid`, `scheduleOnFrom/To`, `scheduleOffFrom/To` (inclusive), `canRepeat` |
| GET    | `/api/courses/{pkid}` | Single course incl. n-n `certifications` / `jobCategories` |
| POST   | `/api/courses` | Create; pkid is int IDENTITY (body pkid ignored); `400` if ScheduleOff < ScheduleOn or a FK does not exist |
| PUT    | `/api/courses` | Update (pkid in body); n-n lists are delete-then-reinserted |
| DELETE | `/api/courses/{pkid}` | Delete (`409` if referenced by `CourseFAQ` / `CourseRelatedLink` / `HotCourse`; n-n rows cascade) |
| GET    | `/api/lookups/certifications` | `{ pkid, title, partnerPkid, partnerName }`, ordered by partner then title |
| GET    | `/api/lookups/job-categories` | `{ pkid, description }`, ordered by pkid |

Frontend routes: `/courses` (list), `/courses/new`, `/courses/:id` (view), `/courses/:id/edit`.
The list keeps its filters, sort and page in sessionStorage (`course-list-filters`, `course-list-sort`, `course-list-page`);
`?partnerPkid=` / `?courseGroupPkid=` / `?publishStatusPkid=` (查看課程 buttons on those pages) replace the saved filters.

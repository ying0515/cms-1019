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

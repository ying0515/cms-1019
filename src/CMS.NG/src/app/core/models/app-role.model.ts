import { AppUserLookup } from './lookup.model';

/** Response model — GET /api/app-roles, GET /api/app-roles/{pkid} */
export interface AppRole {
  pkid: number;
  roleId: string;
  roleName: string;
  permissionLevel: number;
  description: string | null;
  /** Subquery count of AppUserRole rows */
  userCount: number;
  /** Populated on GET by pkid only */
  users: AppUserLookup[];
}

/** Write DTO — POST / PUT /api/app-roles */
export interface AppRoleRequest {
  pkid: number;
  roleId: string;
  roleName: string;
  permissionLevel: number;
  description: string | null;
  /** n-n AppUserRole (AppUser.UserId) */
  userIds: string[];
}

/** Search DTO — POST /api/app-roles/query */
export interface AppRoleQuery {
  keyword?: string | null;
  permissionLevelFrom?: number | null;
  permissionLevelTo?: number | null;
  userId?: string | null;
}

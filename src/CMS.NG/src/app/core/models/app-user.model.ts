import { AppRoleLookup } from './lookup.model';

/** Response model — GET /api/app-users, GET /api/app-users/{pkid}. PasswordHash is never sent. */
export interface AppUser {
  pkid: number;
  userId: string;
  userName: string;
  isActive: boolean;
  /** UTC datetime without suffix — append 'Z' before parsing */
  passwordUpdatedTime: string | null;
  /** Subquery count of AppUserRole rows */
  roleCount: number;
  /** Populated on GET by pkid only */
  roles: AppRoleLookup[];
}

/** Write DTO — POST / PUT /api/app-users. No password field: the backend manages it. */
export interface AppUserRequest {
  pkid: number;
  userId: string;
  userName: string;
  isActive: boolean;
  /** n-n AppUserRole (AppRole.RoleId) */
  roleIds: string[];
}

/** Search DTO — POST /api/app-users/query */
export interface AppUserQuery {
  keyword?: string | null;
  isActive?: boolean | null;
  roleId?: string | null;
}

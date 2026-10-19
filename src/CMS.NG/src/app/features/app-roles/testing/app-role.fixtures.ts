import { AppRole } from '@core/models/app-role.model';
import { AppUserLookup } from '@core/models/lookup.model';

export const APP_USERS: AppUserLookup[] = [
  { userId: 'helen', userName: 'helen', isActive: true },
  { userId: 'jenny', userName: 'Jenny_Tsao', isActive: true },
  { userId: 'miles', userName: 'Miles Sun', isActive: false },
];

export const ADMIN_ROLE: AppRole = {
  pkid: 1,
  roleId: 'Admin',
  roleName: 'Administrator',
  permissionLevel: 1,
  description: '系統管理員',
  userCount: 2,
  users: [APP_USERS[0], APP_USERS[1]],
};

export const USER_ROLE: AppRole = {
  pkid: 2,
  roleId: 'User',
  roleName: 'User',
  permissionLevel: 100,
  description: '一般使用者',
  userCount: 1,
  users: [APP_USERS[2]],
};

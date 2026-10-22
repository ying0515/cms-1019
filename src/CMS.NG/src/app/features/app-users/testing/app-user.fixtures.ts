import { AppUser } from '@core/models/app-user.model';
import { AppRoleLookup } from '@core/models/lookup.model';

export const APP_ROLES: AppRoleLookup[] = [
  { roleId: 'Admin', roleName: 'Administrator' },
  { roleId: 'User', roleName: 'User' },
];

export const HELEN: AppUser = {
  pkid: 1,
  userId: 'helen',
  userName: 'helen',
  isActive: true,
  passwordUpdatedTime: '2026-10-19T02:30:00',
  roleCount: 1,
  roles: [APP_ROLES[0]],
};

export const MILES: AppUser = {
  pkid: 3,
  userId: 'miles',
  userName: 'Miles <Sun>',
  isActive: false,
  passwordUpdatedTime: null,
  roleCount: 1,
  roles: [APP_ROLES[1]],
};

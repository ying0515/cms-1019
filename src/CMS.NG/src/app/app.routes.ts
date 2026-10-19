import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'app-roles' },
  {
    path: 'app-roles',
    title: '角色 AppRole',
    loadComponent: () =>
      import('./features/app-roles/app-role-list/app-role-list').then((m) => m.AppRoleList),
  },
  {
    path: 'app-roles/new',
    title: '新增角色',
    loadComponent: () =>
      import('./features/app-roles/app-role-form/app-role-form').then((m) => m.AppRoleForm),
  },
  {
    path: 'app-roles/:id',
    title: '檢視角色',
    loadComponent: () =>
      import('./features/app-roles/app-role-detail/app-role-detail').then((m) => m.AppRoleDetail),
  },
  {
    path: 'app-roles/:id/edit',
    title: '編輯角色',
    loadComponent: () =>
      import('./features/app-roles/app-role-form/app-role-form').then((m) => m.AppRoleForm),
  },
  { path: '**', redirectTo: 'app-roles' },
];

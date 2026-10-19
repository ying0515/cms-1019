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
  {
    path: 'publish-statuses',
    title: '發布狀態 PublishStatus',
    loadComponent: () =>
      import('./features/publish-statuses/publish-status-list/publish-status-list').then(
        (m) => m.PublishStatusList,
      ),
  },
  {
    path: 'publish-statuses/new',
    title: '新增發布狀態',
    loadComponent: () =>
      import('./features/publish-statuses/publish-status-form/publish-status-form').then(
        (m) => m.PublishStatusForm,
      ),
  },
  {
    path: 'publish-statuses/:id',
    title: '檢視發布狀態',
    loadComponent: () =>
      import('./features/publish-statuses/publish-status-detail/publish-status-detail').then(
        (m) => m.PublishStatusDetail,
      ),
  },
  {
    path: 'publish-statuses/:id/edit',
    title: '編輯發布狀態',
    loadComponent: () =>
      import('./features/publish-statuses/publish-status-form/publish-status-form').then(
        (m) => m.PublishStatusForm,
      ),
  },
  { path: '**', redirectTo: 'app-roles' },
];

import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { AppRoleService } from '@core/services/app-role.service';
import { LookupService } from '@core/services/lookup.service';
import { ADMIN_ROLE, APP_USERS } from '../testing/app-role.fixtures';
import { AppRoleForm } from './app-role-form';

describe('AppRoleForm', () => {
  let roleService: jasmine.SpyObj<AppRoleService>;
  let lookupService: jasmine.SpyObj<LookupService>;
  let router: Router;

  async function setup(id: string | null) {
    roleService = jasmine.createSpyObj<AppRoleService>('AppRoleService', ['getById', 'create', 'update']);
    lookupService = jasmine.createSpyObj<LookupService>('LookupService', ['getAppUsers']);
    roleService.getById.and.returnValue(of(ADMIN_ROLE));
    roleService.create.and.returnValue(of({ ...ADMIN_ROLE, pkid: 7, roleId: 'Editor' }));
    roleService.update.and.returnValue(of(void 0));
    lookupService.getAppUsers.and.returnValue(of(APP_USERS));

    await TestBed.configureTestingModule({
      imports: [AppRoleForm],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        { provide: AppRoleService, useValue: roleService },
        { provide: LookupService, useValue: lookupService },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  }

  function create() {
    const fixture = TestBed.createComponent(AppRoleForm);
    fixture.detectChanges();
    return fixture;
  }

  describe('add mode', () => {
    beforeEach(() => setup(null));

    it('starts empty with PermissionLevel defaulting to 100 and RoleId enabled', () => {
      const c = create().componentInstance;

      expect(c.isEdit).toBeFalse();
      expect(roleService.getById).not.toHaveBeenCalled();
      expect(lookupService.getAppUsers).toHaveBeenCalled();
      expect(c.form.controls.roleId.enabled).toBeTrue();
      expect(c.form.controls.permissionLevel.value).toBe(100);
      expect(c.userOptions.length).toBe(3);
    });

    it('shows the 新增角色 title', () => {
      const fixture = create();
      expect(fixture.nativeElement.querySelector('h1').textContent).toContain('新增角色');
    });

    it('does not submit when required fields are missing', () => {
      const c = create().componentInstance;

      c.save();

      expect(c.form.invalid).toBeTrue();
      expect(c.form.controls.roleId.touched).toBeTrue();
      expect(roleService.create).not.toHaveBeenCalled();
    });

    it('rejects RoleId longer than 200 characters', () => {
      const c = create().componentInstance;
      c.form.controls.roleId.setValue('x'.repeat(201));

      expect(c.form.controls.roleId.hasError('maxlength')).toBeTrue();
    });

    it('creates the role with trimmed values and navigates to the new detail page', () => {
      const c = create().componentInstance;
      c.form.setValue({
        roleId: ' Editor ',
        roleName: ' Content Editor ',
        permissionLevel: 50,
        description: '   ',
        userIds: ['helen', 'miles'],
      });

      c.save();

      expect(roleService.create).toHaveBeenCalledOnceWith({
        pkid: 0,
        roleId: 'Editor',
        roleName: 'Content Editor',
        permissionLevel: 50,
        description: null,
        userIds: ['helen', 'miles'],
      });
      expect(router.navigate).toHaveBeenCalledWith(['/app-roles', 7]);
    });

    it('shows an error toast and stays on the page on 409 Conflict', () => {
      roleService.create.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 409, error: { message: '角色代碼「Admin」已存在' } })),
      );
      const messages = TestBed.inject(MessageService);
      const add = spyOn(messages, 'add');
      const c = create().componentInstance;
      c.form.patchValue({ roleId: 'Admin', roleName: 'Dup' });

      c.save();

      expect(add).toHaveBeenCalledWith(
        jasmine.objectContaining({ severity: 'error', detail: '角色代碼「Admin」已存在' }),
      );
      expect(router.navigate).not.toHaveBeenCalled();
      expect(c.saving()).toBeFalse();
    });

    it('cancel() returns to the list', () => {
      create().componentInstance.cancel();
      expect(router.navigate).toHaveBeenCalledWith(['/app-roles']);
    });
  });

  describe('edit mode', () => {
    beforeEach(() => setup('1'));

    it('loads the role and patches the form, with RoleId disabled', () => {
      const fixture = create();
      const c = fixture.componentInstance;

      expect(c.isEdit).toBeTrue();
      expect(roleService.getById).toHaveBeenCalledOnceWith(1);
      expect(c.form.controls.roleId.disabled).toBeTrue();
      expect(c.form.getRawValue()).toEqual({
        roleId: 'Admin',
        roleName: 'Administrator',
        permissionLevel: 1,
        description: '系統管理員',
        userIds: ['helen', 'jenny'],
      });
      expect(fixture.nativeElement.querySelector('h1').textContent).toContain('編輯角色');
      expect(c.loading()).toBeFalse();
    });

    it('updates with pkid in the body and navigates to the detail page', () => {
      const c = create().componentInstance;
      c.form.patchValue({ roleName: 'Super Admin', userIds: ['miles'] });

      c.save();

      expect(roleService.update).toHaveBeenCalledOnceWith({
        pkid: 1,
        roleId: 'Admin',
        roleName: 'Super Admin',
        permissionLevel: 1,
        description: '系統管理員',
        userIds: ['miles'],
      });
      expect(roleService.create).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/app-roles', 1]);
    });

    it('cancel() returns to the detail page', () => {
      create().componentInstance.cancel();
      expect(router.navigate).toHaveBeenCalledWith(['/app-roles', 1]);
    });
  });
});

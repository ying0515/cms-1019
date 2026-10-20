import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { provideRowAuditStub, rowAuditStub } from '@core/testing/row-audit';
import { AppUserService } from '@core/services/app-user.service';
import { LookupService } from '@core/services/lookup.service';
import { signInForTest } from '@core/testing/auth';
import { expectPinnedToolbar } from '@core/testing/form-toolbar';
import { APP_ROLES, HELEN } from '../testing/app-user.fixtures';
import { AppUserForm } from './app-user-form';

describe('AppUserForm', () => {
  let userService: jasmine.SpyObj<AppUserService>;
  let lookupService: jasmine.SpyObj<LookupService>;
  let router: Router;

  afterEach(() => sessionStorage.clear());

  /** `roles`: the signed-in user's roles (the reset button is Admin only). */
  async function setup(id: string | null, roles: string[] = ['Admin']) {
    sessionStorage.clear();
    signInForTest(roles);
    userService = jasmine.createSpyObj<AppUserService>('AppUserService', [
      'getById',
      'create',
      'update',
      'resetPassword',
    ]);
    userService.resetPassword.and.returnValue(of(void 0));
    lookupService = jasmine.createSpyObj<LookupService>('LookupService', ['getAppRoles']);
    userService.getById.and.returnValue(of(HELEN));
    userService.create.and.returnValue(of({ ...HELEN, pkid: 7, userId: 'amy' }));
    userService.update.and.returnValue(of(void 0));
    lookupService.getAppRoles.and.returnValue(of(APP_ROLES));

    await TestBed.configureTestingModule({
      imports: [AppUserForm],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideNoopAnimations(),
        provideRowAuditStub(),
        MessageService,
        ConfirmationService,
        { provide: AppUserService, useValue: userService },
        { provide: LookupService, useValue: lookupService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  }

  function create() {
    const fixture = TestBed.createComponent(AppUserForm);
    fixture.detectChanges();
    return fixture;
  }

  describe('add mode', () => {
    beforeEach(() => setup(null));

    it('starts empty with IsActive checked, UserId enabled and no password field', () => {
      const fixture = create();
      const c = fixture.componentInstance;

      expect(c.isEdit).toBeFalse();
      expect(userService.getById).not.toHaveBeenCalled();
      expect(c.form.controls.userId.enabled).toBeTrue();
      expect(c.form.controls.isActive.value).toBeTrue();
      expect(Object.keys(c.form.controls).some((k) => /password/i.test(k))).toBeFalse();
      expect(fixture.nativeElement.querySelector('input[type="password"]')).toBeNull();
      expect(fixture.nativeElement.textContent).toContain('系統預設密碼');
      expect(c.roleOptions.length).toBe(2);
    });

    it('shows the 新增使用者 title', () => {
      const fixture = create();
      expect(fixture.nativeElement.querySelector('h1').textContent).toContain('新增使用者');
    });

    it('does not submit when required fields are missing', () => {
      const c = create().componentInstance;

      c.save();

      expect(c.form.invalid).toBeTrue();
      expect(c.form.controls.userId.touched).toBeTrue();
      expect(c.form.controls.userName.hasError('required')).toBeTrue();
      expect(userService.create).not.toHaveBeenCalled();
    });

    it('rejects UserId longer than 200 characters', () => {
      const c = create().componentInstance;
      c.form.controls.userId.setValue('x'.repeat(201));

      expect(c.form.controls.userId.hasError('maxlength')).toBeTrue();
    });

    it('creates the user with trimmed values and navigates to the new detail page', () => {
      const c = create().componentInstance;
      c.form.setValue({
        userId: ' amy ',
        userName: ' Amy Lin ',
        isActive: false,
        roleIds: ['User'],
      });

      c.save();

      expect(userService.create).toHaveBeenCalledOnceWith({
        pkid: 0,
        userId: 'amy',
        userName: 'Amy Lin',
        isActive: false,
        roleIds: ['User'],
      });
      expect(router.navigate).toHaveBeenCalledWith(['/app-users', 7]);
    });

    it('shows an error toast and stays on the page on 409 Conflict', () => {
      userService.create.and.returnValue(
        throwError(
          () =>
            new HttpErrorResponse({ status: 409, error: { message: '使用者帳號「helen」已存在' } }),
        ),
      );
      const add = spyOn(TestBed.inject(MessageService), 'add');
      const c = create().componentInstance;
      c.form.patchValue({ userId: 'helen', userName: 'Dup' });

      c.save();

      expect(add).toHaveBeenCalledWith(
        jasmine.objectContaining({ severity: 'error', detail: '使用者帳號「helen」已存在' }),
      );
      expect(router.navigate).not.toHaveBeenCalled();
      expect(c.saving()).toBeFalse();
    });

    it('pins the Save/Cancel toolbar to the top of the form', () => {
      expectPinnedToolbar(create().nativeElement);
    });

    it('cancel() returns to the list', () => {
      create().componentInstance.cancel();
      expect(router.navigate).toHaveBeenCalledWith(['/app-users']);
    });
  });

  describe('edit mode', () => {
    beforeEach(() => setup('1'));

    it('loads the user and patches the form, with UserId disabled', () => {
      const fixture = create();
      const c = fixture.componentInstance;

      expect(c.isEdit).toBeTrue();
      expect(userService.getById).toHaveBeenCalledOnceWith(1);
      expect(c.form.controls.userId.disabled).toBeTrue();
      expect(c.form.getRawValue()).toEqual({
        userId: 'helen',
        userName: 'helen',
        isActive: true,
        roleIds: ['Admin'],
      });
      expect(fixture.nativeElement.querySelector('h1').textContent).toContain('編輯使用者');
      expect(fixture.nativeElement.textContent).not.toContain('系統預設密碼');
    });

    it('updates with pkid in the body and navigates to the detail page', () => {
      const c = create().componentInstance;
      c.form.patchValue({ userName: 'Helen W', isActive: false, roleIds: [] });

      c.save();

      expect(userService.update).toHaveBeenCalledOnceWith({
        pkid: 1,
        userId: 'helen',
        userName: 'Helen W',
        isActive: false,
        roleIds: [],
      });
      expect(userService.create).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/app-users', 1]);
    });

    it('pins the Save/Cancel toolbar to the top of the form', () => {
      expectPinnedToolbar(create().nativeElement);
    });

    it('cancel() returns to the detail page', () => {
      create().componentInstance.cancel();
      expect(router.navigate).toHaveBeenCalledWith(['/app-users', 1]);
    });
  });

  describe('重設為預設密碼', () => {
    const resetButton = (el: HTMLElement) => el.querySelector('[data-testid="reset-password"]');

    function stubConfirm(accept: boolean): jasmine.Spy {
      const confirmation = TestBed.inject(ConfirmationService);
      return spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
        if (accept) c.accept?.();
        return confirmation;
      });
    }

    it('shows the button in the edit toolbar for Admins', async () => {
      await setup('1', ['Admin']);
      const el: HTMLElement = create().nativeElement;

      const button = resetButton(el);
      expect(button?.textContent).toContain('重設為預設密碼');
      expect(el.querySelector('[data-testid="form-toolbar"]')?.contains(button)).toBeTrue();
    });

    it('shows the button when Admin is one of several roles', async () => {
      await setup('1', ['User', 'Admin']);

      expect(resetButton(create().nativeElement)).not.toBeNull();
    });

    it('hides the button for users without the Admin role', async () => {
      await setup('1', ['User']);
      const fixture = create();

      expect(resetButton(fixture.nativeElement)).toBeNull();
      expect(fixture.componentInstance.canResetPassword).toBeFalse();
    });

    it('hides the button in add mode, even for Admins', async () => {
      await setup(null, ['Admin']);

      expect(resetButton(create().nativeElement)).toBeNull();
    });

    it('asks for confirmation naming the user, then sends only the UserId', async () => {
      await setup('1', ['Admin']);
      const fixture = create();
      const confirm = stubConfirm(true);
      const add = spyOn(TestBed.inject(MessageService), 'add');

      (resetButton(fixture.nativeElement)!.querySelector('button') as HTMLButtonElement).click();

      expect(confirm.calls.mostRecent().args[0].message).toContain('<b>helen</b>');
      expect(userService.resetPassword).toHaveBeenCalledOnceWith('helen');
      expect(userService.update).not.toHaveBeenCalled(); // does not submit the form
      expect(add).toHaveBeenCalledWith(
        jasmine.objectContaining({ severity: 'success', summary: '已重設密碼' }),
      );
    });

    it('does nothing when the confirmation is dismissed', async () => {
      await setup('1', ['Admin']);
      const c = create().componentInstance;
      stubConfirm(false);

      c.confirmResetPassword();

      expect(userService.resetPassword).not.toHaveBeenCalled();
    });

    it('shows an error toast when the API refuses (e.g. 403)', async () => {
      await setup('1', ['Admin']);
      userService.resetPassword.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 403 })),
      );
      const c = create().componentInstance;
      stubConfirm(true);
      const add = spyOn(TestBed.inject(MessageService), 'add');

      c.confirmResetPassword();

      expect(add).toHaveBeenCalledWith(
        jasmine.objectContaining({ severity: 'error', summary: '重設失敗' }),
      );
      expect(c.resetting()).toBeFalse();
    });
  });

  describe('row-audit badge', () => {
    it('shows the badge for the edited record next to the title', async () => {
      await setup('1');
      const fixture = create();

      expect(fixture.nativeElement.querySelector('.form-toolbar .start app-row-audit-badge')).toBeTruthy();
      expect(rowAuditStub().getHistory).toHaveBeenCalledOnceWith('AppUser', 1);
    });

    it('has no badge in add mode', async () => {
      await setup(null);
      const fixture = create();

      expect(fixture.nativeElement.querySelector('app-row-audit-badge')).toBeNull();
      expect(rowAuditStub().getHistory).not.toHaveBeenCalled();
    });
  });
});

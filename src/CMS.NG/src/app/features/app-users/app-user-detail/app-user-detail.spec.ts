import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { AppUserService } from '@core/services/app-user.service';
import { signInForTest } from '@core/testing/auth';
import { HELEN } from '../testing/app-user.fixtures';
import { AppUserDetail } from './app-user-detail';

describe('AppUserDetail', () => {
  let userService: jasmine.SpyObj<AppUserService>;

  afterEach(() => sessionStorage.clear());

  async function setup(id: string | null, roles: string[] = ['Admin']) {
    sessionStorage.clear();
    signInForTest(roles);
    userService = jasmine.createSpyObj<AppUserService>('AppUserService', [
      'getById',
      'delete',
      'resetPassword',
    ]);
    userService.getById.and.returnValue(of(HELEN));
    userService.delete.and.returnValue(of(void 0));
    userService.resetPassword.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [AppUserDetail],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideNoopAnimations(),
        MessageService,
        ConfirmationService,
        { provide: AppUserService, useValue: userService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } },
        },
      ],
    }).compileComponents();
  }

  function create() {
    const fixture = TestBed.createComponent(AppUserDetail);
    fixture.detectChanges();
    return fixture;
  }

  function acceptConfirm(): void {
    const confirmation = TestBed.inject(ConfirmationService);
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      c.accept?.();
      return confirmation;
    });
  }

  it('loads the user by route id and renders fields and roles', async () => {
    await setup('1');
    const fixture = create();
    const el: HTMLElement = fixture.nativeElement;

    expect(userService.getById).toHaveBeenCalledOnceWith(1);
    expect(el.querySelector('.user-id')?.textContent).toContain('helen');
    expect(el.querySelector('.pwd-time')?.textContent).toMatch(/2026-10-1[89]/);
    const roles = el.querySelectorAll('.role-list li');
    expect(roles.length).toBe(1);
    expect(roles[0].textContent).toContain('Administrator (Admin)');
  });

  it('shows not-found on 404', async () => {
    await setup('99');
    userService.getById.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const fixture = create();

    expect(fixture.componentInstance.notFound()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('找不到此使用者資料');
  });

  it('treats a non-numeric id as not found without calling the API', async () => {
    await setup('abc');
    const fixture = create();

    expect(userService.getById).not.toHaveBeenCalled();
    expect(fixture.componentInstance.notFound()).toBeTrue();
  });

  it('edit() navigates to the edit form', async () => {
    await setup('1');
    const fixture = create();
    const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    fixture.componentInstance.edit();

    expect(nav).toHaveBeenCalledWith(['/app-users', 1, 'edit']);
  });

  it('viewRoles() opens the role list filtered by this user', async () => {
    await setup('1');
    const fixture = create();
    const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    fixture.componentInstance.viewRoles();

    expect(nav).toHaveBeenCalledWith(['/app-roles'], { queryParams: { userId: 'helen' } });
  });

  it('confirmResetPassword() resets and reloads the user', async () => {
    await setup('1');
    const fixture = create();
    acceptConfirm();
    userService.getById.calls.reset();

    fixture.componentInstance.confirmResetPassword();

    expect(userService.resetPassword).toHaveBeenCalledOnceWith('helen'); // UserId only
    expect(userService.getById).toHaveBeenCalledOnceWith(1);
  });

  it('shows 重設密碼 only to Admins', async () => {
    await setup('1', ['Admin']);
    expect(create().nativeElement.querySelector('[data-testid="reset-password"]')).not.toBeNull();

    TestBed.resetTestingModule();
    await setup('1', ['User']);
    expect(create().nativeElement.querySelector('[data-testid="reset-password"]')).toBeNull();
  });

  it('confirmDelete() deletes and returns to the list', async () => {
    await setup('1');
    const fixture = create();
    acceptConfirm();
    const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    fixture.componentInstance.confirmDelete();

    expect(userService.delete).toHaveBeenCalledOnceWith(1);
    expect(nav).toHaveBeenCalledWith(['/app-users']);
  });
});

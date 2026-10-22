import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { CurrentUser } from '@core/models/auth.model';
import { AuthService } from '@core/services/auth.service';
import { ChangePassword } from './change-password';

describe('ChangePassword', () => {
  const helen: CurrentUser = { userId: 'helen', userName: 'Helen', mustChangePassword: false, isAdmin: true };
  let auth: jasmine.SpyObj<AuthService>;
  let router: Router;

  async function setup(mustChangePassword: boolean) {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['changePassword', 'logout'], {
      user: signal<CurrentUser | null | undefined>({ ...helen, mustChangePassword }),
    });
    auth.changePassword.and.returnValue(of(helen));
    auth.logout.and.returnValue(of(void 0));
    await TestBed.configureTestingModule({
      imports: [ChangePassword],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        { provide: AuthService, useValue: auth },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ returnUrl: '/courses' }) } },
        },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);

    const fixture = TestBed.createComponent(ChangePassword);
    fixture.detectChanges();
    return fixture;
  }

  function buttonLabels(el: HTMLElement): string[] {
    return Array.from(el.querySelectorAll('p-button')).map((b) => b.textContent?.trim() ?? '');
  }

  it('forced change: explains why and offers 登出 instead of 取消', async () => {
    const fixture = await setup(true);
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('[data-testid="forced-hint"]')).not.toBeNull();
    expect(buttonLabels(el)).toContain('登出');
    expect(buttonLabels(el)).not.toContain('取消');
  });

  it('voluntary change: offers 取消', async () => {
    const fixture = await setup(false);
    expect(fixture.nativeElement.querySelector('[data-testid="forced-hint"]')).toBeNull();
    expect(buttonLabels(fixture.nativeElement)).toContain('取消');
  });

  it('rejects a short or mismatched new password without calling the API', async () => {
    const fixture = await setup(true);
    const form = fixture.componentInstance.form;

    form.setValue({ currentPassword: 'old', newPassword: 'short', confirmPassword: 'short' });
    fixture.componentInstance.submit();
    form.setValue({
      currentPassword: 'old',
      newPassword: 'long-enough-1',
      confirmPassword: 'other-one-1',
    });
    fixture.componentInstance.submit();
    fixture.detectChanges();

    expect(auth.changePassword).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('兩次輸入的新密碼不一致');
  });

  it('changes the password and returns to the requested page', async () => {
    const fixture = await setup(true);
    fixture.componentInstance.form.setValue({
      currentPassword: 'old',
      newPassword: 'long-enough-1',
      confirmPassword: 'long-enough-1',
    });
    fixture.componentInstance.submit();

    expect(auth.changePassword).toHaveBeenCalledWith({
      currentPassword: 'old',
      newPassword: 'long-enough-1',
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/courses');
  });

  it('shows the API message on failure', async () => {
    const fixture = await setup(true);
    auth.changePassword.and.returnValue(
      throwError(
        () => new HttpErrorResponse({ status: 400, error: { message: '目前密碼不正確' } }),
      ),
    );
    fixture.componentInstance.form.setValue({
      currentPassword: 'bad',
      newPassword: 'long-enough-1',
      confirmPassword: 'long-enough-1',
    });
    fixture.componentInstance.submit();
    fixture.detectChanges();

    const error: HTMLElement = fixture.nativeElement.querySelector(
      '[data-testid="change-password-error"]',
    );
    expect(error.textContent).toContain('目前密碼不正確');
  });

  it('登出 signs out and goes to /login', async () => {
    const fixture = await setup(true);
    fixture.componentInstance.logout();

    expect(auth.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});

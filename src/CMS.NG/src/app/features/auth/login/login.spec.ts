import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { CurrentUser } from '@core/models/auth.model';
import { AuthService } from '@core/services/auth.service';
import { Login } from './login';

describe('Login', () => {
  const helen: CurrentUser = { userId: 'helen', userName: 'Helen', mustChangePassword: false, isAdmin: true };
  let auth: jasmine.SpyObj<AuthService>;
  let router: Router;

  async function setup(returnUrl: string | null = null) {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['login']);
    auth.login.and.returnValue(of(helen));
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: AuthService, useValue: auth },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) },
          },
        },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);

    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    return fixture;
  }

  it('does not call the API while fields are empty', async () => {
    const fixture = await setup();
    fixture.componentInstance.submit();
    fixture.detectChanges();

    expect(auth.login).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('請輸入使用者帳號');
    expect(fixture.nativeElement.textContent).toContain('請輸入密碼');
  });

  it('signs in and returns to the requested page', async () => {
    const fixture = await setup('/courses/7');
    fixture.componentInstance.form.setValue({ userId: 'helen', password: 'pw' });
    fixture.componentInstance.submit();

    expect(auth.login).toHaveBeenCalledWith({ userId: 'helen', password: 'pw' });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/courses/7');
  });

  it('ignores an off-site returnUrl', async () => {
    const fixture = await setup('https://evil.example');
    fixture.componentInstance.form.setValue({ userId: 'helen', password: 'pw' });
    fixture.componentInstance.submit();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('sends a default-password user to /change-password', async () => {
    const fixture = await setup('/courses/7');
    auth.login.and.returnValue(of({ ...helen, mustChangePassword: true }));
    fixture.componentInstance.form.setValue({ userId: 'helen', password: 'pw' });
    fixture.componentInstance.submit();

    expect(router.navigate).toHaveBeenCalledWith(['/change-password'], {
      queryParams: { returnUrl: '/courses/7' },
    });
  });

  it('shows the API message and clears the password on failure', async () => {
    const fixture = await setup();
    auth.login.and.returnValue(
      throwError(
        () => new HttpErrorResponse({ status: 401, error: { message: '帳號或密碼錯誤' } }),
      ),
    );
    fixture.componentInstance.form.setValue({ userId: 'helen', password: 'bad' });
    fixture.componentInstance.submit();
    fixture.detectChanges();

    const error: HTMLElement = fixture.nativeElement.querySelector('[data-testid="login-error"]');
    expect(error.textContent).toContain('帳號或密碼錯誤');
    expect(fixture.componentInstance.form.controls.password.value).toBe('');
    expect(fixture.componentInstance.saving()).toBeFalse();
  });
});

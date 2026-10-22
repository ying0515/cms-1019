import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { Observable, firstValueFrom, of } from 'rxjs';

import { CurrentUser } from '@core/models/auth.model';
import { AuthService } from '@core/services/auth.service';
import { adminGuard, authGuard, signedInGuard } from './auth.guard';
import { safeReturnUrl } from './return-url';

describe('auth guards', () => {
  const helen: CurrentUser = { userId: 'helen', userName: 'Helen', mustChangePassword: false, isAdmin: true };
  let auth: jasmine.SpyObj<AuthService>;
  let router: Router;

  function setup(user: CurrentUser | null) {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['ensureLoaded']);
    auth.ensureLoaded.and.returnValue(of(user));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    router = TestBed.inject(Router);
  }

  function run(guard: typeof authGuard, url = '/courses/7'): Promise<boolean | UrlTree> {
    const result = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );
    return firstValueFrom(result as Observable<boolean | UrlTree>);
  }

  it('authGuard lets a signed-in user through', async () => {
    setup(helen);
    expect(await run(authGuard)).toBeTrue();
  });

  it('authGuard sends a signed-out user to /login with returnUrl', async () => {
    setup(null);
    const tree = (await run(authGuard)) as UrlTree;
    expect(router.serializeUrl(tree)).toBe('/login?returnUrl=%2Fcourses%2F7');
  });

  it('authGuard sends a default-password user to /change-password', async () => {
    setup({ ...helen, mustChangePassword: true });
    const tree = (await run(authGuard)) as UrlTree;
    expect(router.serializeUrl(tree)).toBe('/change-password');
  });

  it('signedInGuard allows a default-password user, but not a signed-out one', async () => {
    setup({ ...helen, mustChangePassword: true });
    expect(await run(signedInGuard)).toBeTrue();

    TestBed.resetTestingModule();
    setup(null);
    expect(router.serializeUrl((await run(signedInGuard)) as UrlTree)).toBe('/login');
  });

  it('adminGuard lets an admin through', async () => {
    setup(helen);
    expect(await run(adminGuard, '/app-users')).toBeTrue();
  });

  it('adminGuard sends a non-admin to the home page', async () => {
    setup({ ...helen, isAdmin: false });
    const tree = (await run(adminGuard, '/app-users')) as UrlTree;
    expect(router.serializeUrl(tree)).toBe('/featured-promo-items');
  });
});

describe('safeReturnUrl', () => {
  it('keeps same-app paths', () => {
    expect(safeReturnUrl('/courses/7?tab=1')).toBe('/courses/7?tab=1');
  });

  it('rejects other origins, protocol-relative URLs, /login and empty values', () => {
    for (const url of [
      'https://evil.example',
      '//evil.example',
      'javascript:alert(1)',
      '/login',
      '',
      null,
    ]) {
      expect(safeReturnUrl(url)).withContext(String(url)).toBe('/');
    }
  });
});

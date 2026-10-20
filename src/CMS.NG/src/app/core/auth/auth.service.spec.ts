import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AUTH_PROFILE_KEY, AuthService, LOGIN_URL, PROFILE_URL, decodeToken } from './auth.service';
import { fakeToken, signInForTest } from '../testing/auth';

describe('AuthService', () => {
  function setup(): { service: AuthService; http: HttpTestingController; router: Router } {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    return {
      service: TestBed.inject(AuthService),
      http: TestBed.inject(HttpTestingController),
      router,
    };
  }

  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('login() POSTs { userId, password } and stores the profile in sessionStorage, not localStorage', () => {
    const { service, http } = setup();
    const profile = {
      userId: 'helen',
      userName: '海倫',
      accessToken: fakeToken({ role: 'Admin' }),
    };
    spyOn(localStorage, 'setItem');

    service.login({ userId: 'helen', password: 'pw' }).subscribe();
    const req = http.expectOne(LOGIN_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId: 'helen', password: 'pw' });
    req.flush(profile);

    expect(JSON.parse(sessionStorage.getItem(AUTH_PROFILE_KEY)!)).toEqual(profile);
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(service.profile()).toEqual(profile);
    expect(service.isLoggedIn()).toBeTrue();
    http.verify();
  });

  it('restores the profile from sessionStorage', () => {
    signInForTest(['Admin'], '海倫');
    const { service } = setup();

    expect(service.profile()?.userName).toBe('海倫');
    expect(service.isLoggedIn()).toBeTrue();
  });

  it('reads one role (string claim) from the token', () => {
    signInForTest(['Admin']);

    expect(setup().service.roles()).toEqual(['Admin']);
  });

  it('reads several roles (array claim) from the token', () => {
    signInForTest(['User', 'Admin']);
    const { service } = setup();

    expect(service.roles()).toEqual(['User', 'Admin']);
    expect(service.hasRole('Admin')).toBeTrue();
    expect(service.hasRole('Editor')).toBeFalse();
  });

  it('is not logged in without a token', () => {
    expect(setup().service.isLoggedIn()).toBeFalse();
  });

  it('is not logged in with an expired token', () => {
    const expired = { userId: 'helen', userName: 'helen', accessToken: fakeToken({ exp: 1 }) };
    sessionStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(expired));

    expect(setup().service.isLoggedIn()).toBeFalse();
  });

  it('updateProfile() PUTs { userName } and updates the stored profile, keeping the token', () => {
    const before = signInForTest(['Admin'], '海倫');
    const { service, http } = setup();

    service.updateProfile('新名字').subscribe();
    const req = http.expectOne(PROFILE_URL);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ userName: '新名字' });
    req.flush({ userId: 'helen', userName: '新名字' });

    const stored = JSON.parse(sessionStorage.getItem(AUTH_PROFILE_KEY)!);
    expect(stored).toEqual({ ...before, userName: '新名字' });
    expect(service.profile()?.userName).toBe('新名字');
    http.verify();
  });

  it('logout() clears all of sessionStorage and navigates to /login', () => {
    signInForTest();
    sessionStorage.setItem('courses-list-filters', '{}');
    const { service, router } = setup();

    service.logout();

    expect(sessionStorage.length).toBe(0);
    expect(service.profile()).toBeNull();
    expect(service.isLoggedIn()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: {} });
  });

  it('decodeToken() handles UTF-8 claims and returns null for garbage', () => {
    expect((decodeToken(fakeToken({ name: '海倫' })) as { name?: string }).name).toBe('海倫');
    expect(decodeToken('not-a-jwt')).toBeNull();
  });
});

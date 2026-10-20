import { provideHttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { authGuard } from './auth.guard';
import { AUTH_PROFILE_KEY } from './auth.service';
import { fakeToken, signInForTest } from '../testing/auth';

@Component({ template: '' })
class Page {}

describe('authGuard', () => {
  function setup(): Router {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([
          { path: 'login', component: Page },
          {
            path: '',
            canActivateChild: [authGuard],
            children: [{ path: 'courses', component: Page }],
          },
        ]),
      ],
    });
    return TestBed.inject(Router);
  }

  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('redirects to /login?returnUrl=… when sessionStorage has no token', async () => {
    const router = setup();

    await router.navigateByUrl('/courses?page=2');

    expect(router.url).toBe('/login?returnUrl=%2Fcourses%3Fpage%3D2');
  });

  it('redirects when the stored token is expired', async () => {
    sessionStorage.setItem(
      AUTH_PROFILE_KEY,
      JSON.stringify({ userId: 'helen', userName: 'helen', accessToken: fakeToken({ exp: 1 }) }),
    );
    const router = setup();

    await router.navigateByUrl('/courses');

    expect(router.url).toBe('/login?returnUrl=%2Fcourses');
  });

  it('lets a signed-in user through', async () => {
    signInForTest();
    const router = setup();

    await router.navigateByUrl('/courses');

    expect(router.url).toBe('/courses');
  });

  it('keeps /login public', async () => {
    const router = setup();

    await router.navigateByUrl('/login');

    expect(router.url).toBe('/login');
  });
});

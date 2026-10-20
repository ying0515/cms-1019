import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '@env/environment';

import { authInterceptor } from './auth.interceptor';
import { AUTH_PROFILE_KEY, LOGIN_URL } from './auth.service';
import { signInForTest } from '../testing/auth';

describe('authInterceptor', () => {
  const apiUrl = `${environment.apiUrl}/api/courses`;
  let http: HttpClient;
  let backend: HttpTestingController;
  let router: Router;

  function setup(): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  }

  beforeEach(() => sessionStorage.clear());
  afterEach(() => {
    backend.verify();
    sessionStorage.clear();
  });

  it('attaches Authorization: Bearer <token> from sessionStorage to API requests', () => {
    const profile = signInForTest();
    setup();

    http.get(apiUrl).subscribe();

    const req = backend.expectOne(apiUrl);
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${profile.accessToken}`);
    req.flush([]);
  });

  it('sends no Authorization header when there is no token', () => {
    setup();

    http.get(apiUrl).subscribe();

    const req = backend.expectOne(apiUrl);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush([]);
  });

  it('never sends the token to other hosts', () => {
    signInForTest();
    setup();

    http.get('https://example.com/data').subscribe();

    const req = backend.expectOne('https://example.com/data');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('on a 401 clears sessionStorage and redirects to /login with the current URL', () => {
    signInForTest();
    sessionStorage.setItem('courses-list-page', '2');
    setup();
    spyOnProperty(router, 'url').and.returnValue('/courses?x=1');
    let status = 0;

    http.get(apiUrl).subscribe({ error: (e) => (status = e.status) });
    backend.expectOne(apiUrl).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401); // the caller still sees the error
    expect(sessionStorage.length).toBe(0);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/courses?x=1' },
    });
  });

  it('leaves the session alone on other errors', () => {
    signInForTest();
    setup();

    http.get(apiUrl).subscribe({ error: () => undefined });
    backend.expectOne(apiUrl).flush(null, { status: 500, statusText: 'Server Error' });

    expect(sessionStorage.getItem(AUTH_PROFILE_KEY)).not.toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('a 401 from the login call itself (bad credentials) does not redirect', () => {
    setup();

    http.post(LOGIN_URL, {}).subscribe({ error: () => undefined });
    backend
      .expectOne(LOGIN_URL)
      .flush({ message: '帳號或密碼錯誤' }, { status: 401, statusText: 'Unauthorized' });

    expect(router.navigate).not.toHaveBeenCalled();
  });
});

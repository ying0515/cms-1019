import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { environment } from '@env/environment';

import { SERVER_ERROR_SUMMARY, authInterceptor } from './auth.interceptor';
import { AUTH_PROFILE_KEY, LOGIN_URL } from './auth.service';
import { signInForTest } from '../testing/auth';

describe('authInterceptor', () => {
  const apiUrl = `${environment.apiUrl}/api/courses`;
  let http: HttpClient;
  let backend: HttpTestingController;
  let router: Router;
  let toast: jasmine.Spy;

  function setup(): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        MessageService,
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    toast = spyOn(TestBed.inject(MessageService), 'add');
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

  describe('5xx errors', () => {
    const SAFE = '發生未預期的錯誤，請稍後再試。 An unexpected error occurred.';

    it('shows one friendly toast with the safe message from the response body', () => {
      signInForTest();
      setup();
      let status = 0;

      http.get(apiUrl).subscribe({ error: (e) => (status = e.status) });
      backend
        .expectOne(apiUrl)
        .flush({ message: SAFE, traceId: '00-abc-01' }, { status: 500, statusText: 'Server Error' });

      expect(toast).toHaveBeenCalledOnceWith({
        severity: 'error',
        summary: SERVER_ERROR_SUMMARY,
        detail: SAFE,
      });
      expect(status).toBe(500); // the caller still sees the error (to reset loading / saving)
    });

    it('falls back to a generic message when a 5xx has no JSON body (e.g. a proxy 502)', () => {
      setup();

      http.get(apiUrl).subscribe({ error: () => undefined });
      backend
        .expectOne(apiUrl)
        .flush('<html>Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' });

      expect(toast).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ summary: SERVER_ERROR_SUMMARY, detail: '發生錯誤，請稍後再試' }),
      );
    });

    it('does not toast 4xx errors; pages show those with their own context', () => {
      signInForTest();
      setup();

      for (const status of [400, 403, 404, 409]) {
        http.get(apiUrl).subscribe({ error: () => undefined });
        backend.expectOne(apiUrl).flush({ message: 'x' }, { status, statusText: 'x' });
      }

      expect(toast).not.toHaveBeenCalled();
    });

    it('a 401 still redirects to /login and shows no toast', () => {
      signInForTest();
      setup();

      http.get(apiUrl).subscribe({ error: () => undefined });
      backend.expectOne(apiUrl).flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(sessionStorage.getItem(AUTH_PROFILE_KEY)).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/login'], jasmine.anything());
      expect(toast).not.toHaveBeenCalled();
    });

    it('ignores failures from other hosts', () => {
      setup();

      http.get('https://example.com/data').subscribe({ error: () => undefined });
      backend.expectOne('https://example.com/data').flush(null, { status: 500, statusText: 'x' });

      expect(toast).not.toHaveBeenCalled();
    });
  });
});

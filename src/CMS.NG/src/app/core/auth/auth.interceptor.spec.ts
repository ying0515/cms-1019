import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '@env/environment';

import { AuthService } from '@core/services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let router: Router;
  let auth: AuthService;

  beforeEach(() => {
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
    auth = TestBed.inject(AuthService);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  afterEach(() => backend.verify());

  it('sends the session cookie to the API', () => {
    http.get(`${environment.apiUrl}/api/courses`).subscribe();
    expect(
      backend.expectOne(`${environment.apiUrl}/api/courses`).request.withCredentials,
    ).toBeTrue();
  });

  it('leaves other hosts alone', () => {
    http.get('https://example.com/x').subscribe();
    expect(backend.expectOne('https://example.com/x').request.withCredentials).toBeFalse();
  });

  it('on 401 ends the session and goes to /login with the current page', () => {
    auth.user.set({ userId: 'helen', userName: 'Helen', mustChangePassword: false, isAdmin: true });
    spyOnProperty(router, 'url').and.returnValue('/courses/7');

    http.get(`${environment.apiUrl}/api/courses`).subscribe({ error: () => undefined });
    backend
      .expectOne(`${environment.apiUrl}/api/courses`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.user()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/courses/7' },
    });
  });

  it('does not redirect on a 401 from /api/auth (wrong password, /me)', () => {
    http.post(`${environment.apiUrl}/api/auth/login`, {}).subscribe({ error: () => undefined });
    backend
      .expectOne(`${environment.apiUrl}/api/auth/login`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(router.navigate).not.toHaveBeenCalled();
  });
});

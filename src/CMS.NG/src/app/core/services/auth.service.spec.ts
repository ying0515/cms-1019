import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';

import { AuthService } from './auth.service';
import { CurrentUser } from '../models/auth.model';

describe('AuthService', () => {
  const baseUrl = `${environment.apiUrl}/api/auth`;
  const helen: CurrentUser = { userId: 'helen', userName: 'Helen', mustChangePassword: false };
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('ensureLoaded() GETs /me once, then reuses user()', () => {
    let result: CurrentUser | null | undefined;
    service.ensureLoaded().subscribe((u) => (result = u));
    http.expectOne({ method: 'GET', url: `${baseUrl}/me` }).flush(helen);

    expect(result).toEqual(helen);
    expect(service.user()).toEqual(helen);

    service.ensureLoaded().subscribe((u) => (result = u));
    http.expectNone(`${baseUrl}/me`);
    expect(result).toEqual(helen);
  });

  it('ensureLoaded() maps 401 to null (signed out)', () => {
    let result: CurrentUser | null | undefined;
    service.ensureLoaded().subscribe((u) => (result = u));
    http.expectOne(`${baseUrl}/me`).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(result).toBeNull();
    expect(service.user()).toBeNull();
  });

  it('ensureLoaded() rethrows other errors and stays unknown', () => {
    let failed = false;
    service.ensureLoaded().subscribe({ error: () => (failed = true) });
    http.expectOne(`${baseUrl}/me`).flush(null, { status: 0, statusText: 'Unknown Error' });

    expect(failed).toBeTrue();
    expect(service.user()).toBeUndefined();
  });

  it('login() POSTs the credentials and stores the user', () => {
    service.login({ userId: 'helen', password: 'pw' }).subscribe();
    const req = http.expectOne({ method: 'POST', url: `${baseUrl}/login` });
    expect(req.request.body).toEqual({ userId: 'helen', password: 'pw' });
    req.flush(helen);

    expect(service.user()).toEqual(helen);
  });

  it('changePassword() POSTs and stores the updated user', () => {
    service.user.set({ ...helen, mustChangePassword: true });
    service.changePassword({ currentPassword: 'a', newPassword: 'b' }).subscribe();
    http.expectOne({ method: 'POST', url: `${baseUrl}/change-password` }).flush(helen);

    expect(service.user()?.mustChangePassword).toBeFalse();
  });

  it('logout() clears the user even when the request fails', () => {
    service.user.set(helen);
    service.logout().subscribe();
    http.expectOne({ method: 'POST', url: `${baseUrl}/logout` }).flush(null, {
      status: 0,
      statusText: 'Unknown Error',
    });

    expect(service.user()).toBeNull();
  });
});

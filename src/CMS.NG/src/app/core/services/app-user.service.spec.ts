import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';

import { AppUserService } from './app-user.service';
import { AppUser, AppUserRequest } from '../models/app-user.model';

describe('AppUserService', () => {
  const baseUrl = `${environment.apiUrl}/api/app-users`;
  let service: AppUserService;
  let http: HttpTestingController;

  const user: AppUser = {
    pkid: 1,
    userId: 'helen',
    userName: 'helen',
    isActive: true,
    passwordUpdatedTime: '2026-10-19T02:30:00',
    roleCount: 1,
    roles: [],
  };

  const request: AppUserRequest = {
    pkid: 0,
    userId: 'amy',
    userName: 'Amy Lin',
    isActive: true,
    roleIds: ['User'],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AppUserService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAll() GETs /api/app-users', () => {
    let result: AppUser[] | undefined;
    service.getAll().subscribe((r) => (result = r));

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush([user]);

    expect(result).toEqual([user]);
  });

  it('query() POSTs the filter body to /api/app-users/query', () => {
    const query = { keyword: 'hel', isActive: true, roleId: 'Admin' };
    let result: AppUser[] | undefined;
    service.query(query).subscribe((r) => (result = r));

    const req = http.expectOne(`${baseUrl}/query`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(query);
    req.flush([user]);

    expect(result?.length).toBe(1);
  });

  it('getById() GETs /api/app-users/{pkid}', () => {
    let result: AppUser | undefined;
    service.getById(1).subscribe((r) => (result = r));

    const req = http.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(user);

    expect(result?.userId).toBe('helen');
  });

  it('create() POSTs the request (no password field) to /api/app-users', () => {
    let result: AppUser | undefined;
    service.create(request).subscribe((r) => (result = r));

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    expect(Object.keys(req.request.body).some((k) => /password/i.test(k))).toBeFalse();
    req.flush({ ...user, pkid: 4, userId: 'amy' });

    expect(result?.pkid).toBe(4);
  });

  it('update() PUTs to /api/app-users with pkid in the body (no route param)', () => {
    const update = { ...request, pkid: 2 };
    let done = false;
    service.update(update).subscribe(() => (done = true));

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.pkid).toBe(2);
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(done).toBeTrue();
  });

  it('resetPassword() POSTs only { userId } to /api/auth/reset-password', () => {
    let done = false;
    service.resetPassword('miles').subscribe(() => (done = true));

    const req = http.expectOne(`${environment.apiUrl}/api/auth/reset-password`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId: 'miles' });
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(done).toBeTrue();
  });

  it('delete() DELETEs /api/app-users/{pkid}', () => {
    service.delete(5).subscribe();

    const req = http.expectOne(`${baseUrl}/5`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('propagates HTTP errors (e.g. 409 Conflict)', () => {
    let status = 0;
    service.create(request).subscribe({ error: (e) => (status = e.status) });

    http.expectOne(baseUrl).flush({ message: 'dup' }, { status: 409, statusText: 'Conflict' });

    expect(status).toBe(409);
  });
});

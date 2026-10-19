import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';

import { AppRoleService } from './app-role.service';
import { AppRole, AppRoleRequest } from '../models/app-role.model';

describe('AppRoleService', () => {
  const baseUrl = `${environment.apiUrl}/api/app-roles`;
  let service: AppRoleService;
  let http: HttpTestingController;

  const role: AppRole = {
    pkid: 1,
    roleId: 'Admin',
    roleName: 'Administrator',
    permissionLevel: 1,
    description: '系統管理員',
    userCount: 2,
    users: [],
  };

  const request: AppRoleRequest = {
    pkid: 0,
    roleId: 'Editor',
    roleName: 'Editor',
    permissionLevel: 50,
    description: null,
    userIds: ['helen'],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AppRoleService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAll() GETs /api/app-roles', () => {
    let result: AppRole[] | undefined;
    service.getAll().subscribe((r) => (result = r));

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush([role]);

    expect(result).toEqual([role]);
  });

  it('query() POSTs the filter body to /api/app-roles/query', () => {
    const query = { keyword: 'adm', permissionLevelFrom: 1, permissionLevelTo: null, userId: 'helen' };
    let result: AppRole[] | undefined;
    service.query(query).subscribe((r) => (result = r));

    const req = http.expectOne(`${baseUrl}/query`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(query);
    req.flush([role]);

    expect(result?.length).toBe(1);
  });

  it('getById() GETs /api/app-roles/{pkid}', () => {
    let result: AppRole | undefined;
    service.getById(1).subscribe((r) => (result = r));

    const req = http.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(role);

    expect(result?.roleId).toBe('Admin');
  });

  it('create() POSTs the request to /api/app-roles', () => {
    let result: AppRole | undefined;
    service.create(request).subscribe((r) => (result = r));

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({ ...role, pkid: 3, roleId: 'Editor' });

    expect(result?.pkid).toBe(3);
  });

  it('update() PUTs to /api/app-roles with pkid in the body (no route param)', () => {
    const update = { ...request, pkid: 2 };
    let done = false;
    service.update(update).subscribe(() => (done = true));

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.pkid).toBe(2);
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(done).toBeTrue();
  });

  it('delete() DELETEs /api/app-roles/{pkid}', () => {
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

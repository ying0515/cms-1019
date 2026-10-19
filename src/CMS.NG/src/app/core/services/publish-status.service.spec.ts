import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';

import { PublishStatusService } from './publish-status.service';
import { PublishStatus, PublishStatusRequest } from '../models/publish-status.model';

describe('PublishStatusService', () => {
  const baseUrl = `${environment.apiUrl}/api/publish-statuses`;
  let service: PublishStatusService;
  let http: HttpTestingController;

  const status: PublishStatus = {
    pkid: 1,
    description: '草稿',
    isDraft: true,
    isPublished: false,
    isDiscontinued: false,
  };

  const request: PublishStatusRequest = {
    pkid: 10,
    description: '審核中',
    isDraft: true,
    isPublished: false,
    isDiscontinued: false,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PublishStatusService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAll() GETs /api/publish-statuses', () => {
    let result: PublishStatus[] | undefined;
    service.getAll().subscribe((r) => (result = r));

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush([status]);

    expect(result).toEqual([status]);
  });

  it('query() POSTs the filter body to /api/publish-statuses/query', () => {
    const query = { keyword: '草', isDraft: true, isPublished: null, isDiscontinued: false };
    let result: PublishStatus[] | undefined;
    service.query(query).subscribe((r) => (result = r));

    const req = http.expectOne(`${baseUrl}/query`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(query);
    req.flush([status]);

    expect(result?.length).toBe(1);
  });

  it('getById() GETs /api/publish-statuses/{pkid}', () => {
    let result: PublishStatus | undefined;
    service.getById(1).subscribe((r) => (result = r));

    const req = http.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(status);

    expect(result?.description).toBe('草稿');
  });

  it('getById() works for pkid 0', () => {
    service.getById(0).subscribe();

    http.expectOne(`${baseUrl}/0`).flush({ ...status, pkid: 0 });
  });

  it('create() POSTs the request (with user-supplied pkid) to /api/publish-statuses', () => {
    let result: PublishStatus | undefined;
    service.create(request).subscribe((r) => (result = r));

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({ ...status, pkid: 10, description: '審核中' });

    expect(result?.pkid).toBe(10);
  });

  it('update() PUTs to /api/publish-statuses with pkid in the body (no route param)', () => {
    let done = false;
    service.update({ ...request, pkid: 2 }).subscribe(() => (done = true));

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.pkid).toBe(2);
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(done).toBeTrue();
  });

  it('delete() DELETEs /api/publish-statuses/{pkid}', () => {
    service.delete(3).subscribe();

    const req = http.expectOne(`${baseUrl}/3`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('propagates HTTP errors (e.g. 409 Conflict)', () => {
    let status = 0;
    service.delete(2).subscribe({ error: (e) => (status = e.status) });

    http.expectOne(`${baseUrl}/2`).flush({ message: 'in use' }, { status: 409, statusText: 'Conflict' });

    expect(status).toBe(409);
  });
});

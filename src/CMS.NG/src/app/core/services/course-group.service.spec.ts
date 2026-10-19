import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';

import { CourseGroupService } from './course-group.service';
import { CourseGroup } from '../models/course-group.model';

describe('CourseGroupService', () => {
  const baseUrl = `${environment.apiUrl}/api/course-groups`;
  let service: CourseGroupService;
  let http: HttpTestingController;

  const group: CourseGroup = { pkid: 1, description: '雲端運算' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CourseGroupService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAll() GETs /api/course-groups', () => {
    let result: CourseGroup[] | undefined;
    service.getAll().subscribe((r) => (result = r));

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush([group]);

    expect(result).toEqual([group]);
  });

  it('query() POSTs the filter body to /api/course-groups/query', () => {
    const query = { keyword: '雲端' };
    let result: CourseGroup[] | undefined;
    service.query(query).subscribe((r) => (result = r));

    const req = http.expectOne(`${baseUrl}/query`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(query);
    req.flush([group]);

    expect(result?.length).toBe(1);
  });

  it('getById() GETs /api/course-groups/{pkid}', () => {
    let result: CourseGroup | undefined;
    service.getById(1).subscribe((r) => (result = r));

    const req = http.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(group);

    expect(result?.description).toBe('雲端運算');
  });

  it('create() POSTs the request to /api/course-groups and returns the created group', () => {
    const request = { pkid: 0, description: '資料庫' };
    let result: CourseGroup | undefined;
    service.create(request).subscribe((r) => (result = r));

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({ pkid: 4, description: '資料庫' });

    expect(result?.pkid).toBe(4);
  });

  it('update() PUTs to /api/course-groups with pkid in the body (no route param)', () => {
    let done = false;
    service.update({ pkid: 2, description: '資安' }).subscribe(() => (done = true));

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.pkid).toBe(2);
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(done).toBeTrue();
  });

  it('delete() DELETEs /api/course-groups/{pkid}', () => {
    service.delete(3).subscribe();

    const req = http.expectOne(`${baseUrl}/3`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('propagates HTTP errors (e.g. 409 Conflict)', () => {
    let status = 0;
    service.delete(1).subscribe({ error: (e) => (status = e.status) });

    http
      .expectOne(`${baseUrl}/1`)
      .flush({ message: 'in use' }, { status: 409, statusText: 'Conflict' });

    expect(status).toBe(409);
  });
});

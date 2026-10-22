import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';

import { CourseService } from './course.service';
import { CourseQuery, CourseRequest } from '../models/course.model';
import { AZ104 } from '../../features/courses/testing/course.fixtures';

describe('CourseService', () => {
  const baseUrl = `${environment.apiUrl}/api/courses`;
  let service: CourseService;
  let http: HttpTestingController;

  const request: CourseRequest = {
    pkid: 0,
    title: 'Oracle 資料庫管理',
    officialTitle: null,
    courseId: 'ORA-DBA',
    prodCourseId: '1Z0-082',
    friendlyUrl: 'oracle-dba',
    displayOrder: 5,
    partnerPkid: 2,
    courseGroupPkid: null,
    publishStatusPkid: 1,
    scheduleOn: '2026-10-01',
    scheduleOff: '2036-10-01',
    hour: 30,
    listPrice: 30000,
    learningCredit: 3.5,
    material: null,
    objective: null,
    target: null,
    prerequisites: null,
    outline: null,
    towardCertOrExam: null,
    note: null,
    otherInfo: null,
    canRepeat: true,
    certificationPkids: [3],
    jobCategoryPkids: [1],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CourseService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAll() GETs /api/courses', () => {
    let result: unknown;
    service.getAll().subscribe((r) => (result = r));

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush([AZ104]);

    expect(result).toEqual([AZ104]);
  });

  it('query() POSTs the filter body to /api/courses/query', () => {
    const query: CourseQuery = {
      keyword: 'az',
      partnerPkid: 1,
      scheduleOnFrom: '2026-01-01',
      canRepeat: true,
    };
    let count = 0;
    service.query(query).subscribe((r) => (count = r.length));

    const req = http.expectOne(`${baseUrl}/query`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(query);
    req.flush([AZ104]);

    expect(count).toBe(1);
  });

  it('getById() GETs /api/courses/{pkid}', () => {
    let title = '';
    service.getById(1).subscribe((r) => (title = r.title));

    const req = http.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(AZ104);

    expect(title).toBe(AZ104.title);
  });

  it('create() POSTs the request and returns the created course', () => {
    let pkid = 0;
    service.create(request).subscribe((r) => (pkid = r.pkid));

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({ ...AZ104, pkid: 4 });

    expect(pkid).toBe(4);
  });

  it('update() PUTs to /api/courses with pkid in the body (no route param)', () => {
    let done = false;
    service.update({ ...request, pkid: 2 }).subscribe(() => (done = true));

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.pkid).toBe(2);
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(done).toBeTrue();
  });

  it('delete() DELETEs /api/courses/{pkid}', () => {
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

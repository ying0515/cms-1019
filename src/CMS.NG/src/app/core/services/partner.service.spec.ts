import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';

import { PartnerService } from './partner.service';
import { Partner, PartnerRequest } from '../models/partner.model';

describe('PartnerService', () => {
  const baseUrl = `${environment.apiUrl}/api/partners`;
  let service: PartnerService;
  let http: HttpTestingController;

  const partner: Partner = {
    pkid: 1,
    name: 'Microsoft',
    appKey: 'MS',
    nameOnPartnerMenu: '微軟 Microsoft',
    nameOnCourseDetailPage: '微軟',
    displayOrder: 1,
    imageFilename: 'ms.png',
  };

  const request: PartnerRequest = {
    pkid: 0,
    name: 'Oracle',
    appKey: 'ORA',
    nameOnPartnerMenu: '甲骨文 Oracle',
    nameOnCourseDetailPage: '甲骨文',
    displayOrder: 5,
    imageFilename: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PartnerService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAll() GETs /api/partners', () => {
    let result: Partner[] | undefined;
    service.getAll().subscribe((r) => (result = r));

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush([partner]);

    expect(result).toEqual([partner]);
  });

  it('query() POSTs the filter body to /api/partners/query', () => {
    const query = { keyword: 'micro' };
    let result: Partner[] | undefined;
    service.query(query).subscribe((r) => (result = r));

    const req = http.expectOne(`${baseUrl}/query`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(query);
    req.flush([partner]);

    expect(result?.length).toBe(1);
  });

  it('getById() GETs /api/partners/{pkid}', () => {
    let result: Partner | undefined;
    service.getById(1).subscribe((r) => (result = r));

    const req = http.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(partner);

    expect(result?.name).toBe('Microsoft');
  });

  it('create() POSTs the request to /api/partners and returns the created partner', () => {
    let result: Partner | undefined;
    service.create(request).subscribe((r) => (result = r));

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({ ...partner, pkid: 4, name: 'Oracle' });

    expect(result?.pkid).toBe(4);
  });

  it('update() PUTs to /api/partners with pkid in the body (no route param)', () => {
    let done = false;
    service.update({ ...request, pkid: 2 }).subscribe(() => (done = true));

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.pkid).toBe(2);
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(done).toBeTrue();
  });

  it('delete() DELETEs /api/partners/{pkid}', () => {
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

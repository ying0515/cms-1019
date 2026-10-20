import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';

import { FeaturedPromoItemService } from './featured-promo-item.service';
import {
  FeaturedPromoItemQuery,
  FeaturedPromoItemRequest,
} from '../models/featured-promo-item.model';
import {
  MON_SLOT1,
  MON_SLOT2,
} from '../../features/featured-promo-items/testing/featured-promo-item.fixtures';

describe('FeaturedPromoItemService', () => {
  const baseUrl = `${environment.apiUrl}/api/featured-promo-items`;
  let service: FeaturedPromoItemService;
  let http: HttpTestingController;

  const request: FeaturedPromoItemRequest = {
    pkid: 0,
    scheduleOn: '2026-03-18',
    trainingCenterPkid: 1,
    slot: 1,
    promotionPkid: 3404,
    topic: 'Google AI工具一次掌握',
    description: '不需技術基礎',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FeaturedPromoItemService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAll() GETs /api/featured-promo-items', () => {
    let result: unknown;
    service.getAll().subscribe((r) => (result = r));

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush([MON_SLOT1]);

    expect(result).toEqual([MON_SLOT1]);
  });

  it('query() POSTs the training center and week to /api/featured-promo-items/query', () => {
    const query: FeaturedPromoItemQuery = { trainingCenterPkid: 1, weekOf: '2026-03-16' };
    let count = 0;
    service.query(query).subscribe((r) => (count = r.length));

    const req = http.expectOne(`${baseUrl}/query`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(query);
    req.flush([MON_SLOT1, MON_SLOT2]);

    expect(count).toBe(2);
  });

  it('getById() GETs /api/featured-promo-items/{pkid}', () => {
    let code = '';
    service.getById(101).subscribe((r) => (code = r.promotion!.promoCode));

    const req = http.expectOne(`${baseUrl}/101`);
    expect(req.request.method).toBe('GET');
    req.flush(MON_SLOT1);

    expect(code).toBe('20251204_SkillTrainAI');
  });

  it('create() POSTs the request and returns the created item', () => {
    let pkid = 0;
    service.create(request).subscribe((r) => (pkid = r.pkid));

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({ ...MON_SLOT2, pkid: 200 });

    expect(pkid).toBe(200);
  });

  it('update() PUTs to /api/featured-promo-items with pkid in the body (no route param)', () => {
    let done = false;
    service.update({ ...request, pkid: 102 }).subscribe(() => (done = true));

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.pkid).toBe(102);
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(done).toBeTrue();
  });

  it('delete() DELETEs /api/featured-promo-items/{pkid}', () => {
    service.delete(103).subscribe();

    const req = http.expectOne(`${baseUrl}/103`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('moveDown() POSTs /api/featured-promo-items/{pkid}/move-down with no body', () => {
    service.moveDown(101).subscribe();

    const req = http.expectOne(`${baseUrl}/101/move-down`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('moveUp() POSTs /api/featured-promo-items/{pkid}/move-up', () => {
    service.moveUp(102).subscribe();

    const req = http.expectOne(`${baseUrl}/102/move-up`);
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('propagates HTTP errors (e.g. 409 slot taken)', () => {
    let status = 0;
    service.create(request).subscribe({ error: (e) => (status = e.status) });

    http
      .expectOne(baseUrl)
      .flush({ message: '2026-03-18 第 1 則已有資料' }, { status: 409, statusText: 'Conflict' });

    expect(status).toBe(409);
  });
});

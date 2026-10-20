import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';

import { ModelPriceService } from './model-price.service';
import { ModelPrice, ModelPriceRequest } from '../models/model-price.model';

describe('ModelPriceService', () => {
  const baseUrl = `${environment.apiUrl}/api/model-prices`;
  let service: ModelPriceService;
  let http: HttpTestingController;

  const price: ModelPrice = {
    pkid: 1,
    model: 'claude-opus-5-5',
    effectiveFrom: '2026-01-01',
    inputPrice: 4,
    outputPrice: 20,
    cacheWritePrice: 8,
    cacheReadPrice: 0.2,
  };

  const request: ModelPriceRequest = { ...price, pkid: 0, effectiveFrom: '2026-10-01' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ModelPriceService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAll() GETs /api/model-prices', () => {
    let result: ModelPrice[] | undefined;
    service.getAll().subscribe((r) => (result = r));

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush([price]);
    expect(result).toEqual([price]);
  });

  it('query() POSTs the filters to /query', () => {
    const query = { keyword: 'opus', effectiveFromFrom: '2026-01-01', effectiveFromTo: null };
    service.query(query).subscribe();

    const req = http.expectOne(`${baseUrl}/query`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(query);
    req.flush([]);
  });

  it('getById() GETs /{pkid}', () => {
    service.getById(1).subscribe();

    const req = http.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(price);
  });

  it('create() POSTs the request', () => {
    service.create(request).subscribe();

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({ ...request, pkid: 4 });
  });

  it('update() PUTs the request with its pkid', () => {
    service.update({ ...request, pkid: 1 }).subscribe();

    const req = http.expectOne(baseUrl);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.pkid).toBe(1);
    req.flush(null);
  });

  it('delete() DELETEs /{pkid}', () => {
    service.delete(3).subscribe();

    const req = http.expectOne(`${baseUrl}/3`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});

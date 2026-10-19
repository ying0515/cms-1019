import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';

import { LookupService } from './lookup.service';

describe('LookupService', () => {
  let service: LookupService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LookupService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAppUsers() GETs /api/lookups/app-users', () => {
    const users = [{ userId: 'helen', userName: 'helen', isActive: true }];
    let result: unknown;
    service.getAppUsers().subscribe((r) => (result = r));

    const req = http.expectOne(`${environment.apiUrl}/api/lookups/app-users`);
    expect(req.request.method).toBe('GET');
    req.flush(users);

    expect(result).toEqual(users);
  });

  it('getPublishStatuses() GETs /api/lookups/publish-statuses', () => {
    const statuses = [{ pkid: 1, description: '草稿' }];
    let result: unknown;
    service.getPublishStatuses().subscribe((r) => (result = r));

    const req = http.expectOne(`${environment.apiUrl}/api/lookups/publish-statuses`);
    expect(req.request.method).toBe('GET');
    req.flush(statuses);

    expect(result).toEqual(statuses);
  });
});

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

  it('getPartners() GETs /api/lookups/partners', () => {
    const partners = [{ pkid: 1, name: 'Microsoft' }];
    let result: unknown;
    service.getPartners().subscribe((r) => (result = r));

    const req = http.expectOne(`${environment.apiUrl}/api/lookups/partners`);
    expect(req.request.method).toBe('GET');
    req.flush(partners);

    expect(result).toEqual(partners);
  });

  it('getCourseGroups() GETs /api/lookups/course-groups', () => {
    const groups = [{ pkid: 1, description: '雲端運算' }];
    let result: unknown;
    service.getCourseGroups().subscribe((r) => (result = r));

    const req = http.expectOne(`${environment.apiUrl}/api/lookups/course-groups`);
    expect(req.request.method).toBe('GET');
    req.flush(groups);

    expect(result).toEqual(groups);
  });

  it('getCertifications() GETs /api/lookups/certifications', () => {
    const certs = [{ pkid: 1, title: 'CCNA', partnerPkid: 2, partnerName: 'Cisco' }];
    let result: unknown;
    service.getCertifications().subscribe((r) => (result = r));

    const req = http.expectOne(`${environment.apiUrl}/api/lookups/certifications`);
    expect(req.request.method).toBe('GET');
    req.flush(certs);

    expect(result).toEqual(certs);
  });

  it('getJobCategories() GETs /api/lookups/job-categories', () => {
    const jobs = [{ pkid: 1, description: '系統管理' }];
    let result: unknown;
    service.getJobCategories().subscribe((r) => (result = r));

    const req = http.expectOne(`${environment.apiUrl}/api/lookups/job-categories`);
    expect(req.request.method).toBe('GET');
    req.flush(jobs);

    expect(result).toEqual(jobs);
  });

  it('getAppRoles() GETs /api/lookups/app-roles', () => {
    const roles = [{ roleId: 'Admin', roleName: 'Administrator' }];
    let result: unknown;
    service.getAppRoles().subscribe((r) => (result = r));

    const req = http.expectOne(`${environment.apiUrl}/api/lookups/app-roles`);
    expect(req.request.method).toBe('GET');
    req.flush(roles);

    expect(result).toEqual(roles);
  });

  it('getTrainingCenters() GETs /api/lookups/training-centers', () => {
    const centers = [{ pkid: 1, name: '台北' }];
    let result: unknown;
    service.getTrainingCenters().subscribe((r) => (result = r));

    const req = http.expectOne(`${environment.apiUrl}/api/lookups/training-centers`);
    expect(req.request.method).toBe('GET');
    req.flush(centers);

    expect(result).toEqual(centers);
  });

  it('getPromotions() GETs /api/lookups/promotions with keyword and take', () => {
    const promos = [{ pkid: 3404, promoCode: '251211_GoogleAI', topic: 't', description: 'd' }];
    let result: unknown;
    service.getPromotions('2512_G').subscribe((r) => (result = r));

    const req = http.expectOne(
      (r) => r.url === `${environment.apiUrl}/api/lookups/promotions`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('keyword')).toBe('2512_G');
    expect(req.request.params.get('take')).toBe('20');
    req.flush(promos);

    expect(result).toEqual(promos);
  });
});

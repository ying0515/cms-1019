import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  AppRoleLookup,
  AppUserLookup,
  CertificationLookup,
  CourseGroupLookup,
  JobCategoryLookup,
  PartnerLookup,
  PublishStatusLookup,
} from '../models/lookup.model';

@Injectable({ providedIn: 'root' })
export class LookupService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/lookups`;

  getAppUsers(): Observable<AppUserLookup[]> {
    return this.http.get<AppUserLookup[]>(`${this.baseUrl}/app-users`);
  }

  getAppRoles(): Observable<AppRoleLookup[]> {
    return this.http.get<AppRoleLookup[]>(`${this.baseUrl}/app-roles`);
  }

  getPublishStatuses():Observable<PublishStatusLookup[]> {
    return this.http.get<PublishStatusLookup[]>(`${this.baseUrl}/publish-statuses`);
  }

  getPartners(): Observable<PartnerLookup[]> {
    return this.http.get<PartnerLookup[]>(`${this.baseUrl}/partners`);
  }

  getCourseGroups(): Observable<CourseGroupLookup[]> {
    return this.http.get<CourseGroupLookup[]>(`${this.baseUrl}/course-groups`);
  }

  getCertifications(): Observable<CertificationLookup[]> {
    return this.http.get<CertificationLookup[]>(`${this.baseUrl}/certifications`);
  }

  getJobCategories(): Observable<JobCategoryLookup[]> {
    return this.http.get<JobCategoryLookup[]>(`${this.baseUrl}/job-categories`);
  }
}

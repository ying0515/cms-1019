import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { CourseGroup, CourseGroupQuery, CourseGroupRequest } from '../models/course-group.model';

@Injectable({ providedIn: 'root' })
export class CourseGroupService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/course-groups`;

  getAll(): Observable<CourseGroup[]> {
    return this.http.get<CourseGroup[]>(this.baseUrl);
  }

  query(query: CourseGroupQuery): Observable<CourseGroup[]> {
    return this.http.post<CourseGroup[]>(`${this.baseUrl}/query`, query);
  }

  getById(pkid: number): Observable<CourseGroup> {
    return this.http.get<CourseGroup>(`${this.baseUrl}/${pkid}`);
  }

  create(request: CourseGroupRequest): Observable<CourseGroup> {
    return this.http.post<CourseGroup>(this.baseUrl, request);
  }

  update(request: CourseGroupRequest): Observable<void> {
    return this.http.put<void>(this.baseUrl, request);
  }

  delete(pkid: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${pkid}`);
  }
}

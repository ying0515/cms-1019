import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { RowAuditEntry } from '../models/row-audit.model';

@Injectable({ providedIn: 'root' })
export class RowAuditService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/rowaudit`;

  /** The record's history, newest first. `tableName` is the DB table name (e.g. 'Course'). */
  getHistory(tableName: string, pkid: number | string): Observable<RowAuditEntry[]> {
    return this.http.get<RowAuditEntry[]>(this.baseUrl, {
      params: { tableName, pkid: String(pkid) },
    });
  }
}

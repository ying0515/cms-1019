import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  AgentTokenUsageReportQuery,
  AgentTokenUsageReportRow,
} from '../models/agent-token-usage.model';

@Injectable({ providedIn: 'root' })
export class AgentTokenUsageService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/agent-token-usage`;

  report(query: AgentTokenUsageReportQuery): Observable<AgentTokenUsageReportRow[]> {
    return this.http.post<AgentTokenUsageReportRow[]>(`${this.baseUrl}/report`, query);
  }
}

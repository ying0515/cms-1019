import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env/environment';
import { AgentTokenUsageService } from './agent-token-usage.service';

describe('AgentTokenUsageService', () => {
  let service: AgentTokenUsageService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AgentTokenUsageService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('report() POSTs the query to /api/agent-token-usage/report', () => {
    const query = { usageDateFrom: '2026-10-01', usageDateTo: '2026-10-20' };
    service.report(query).subscribe((rows) => expect(rows).toEqual([]));

    const req = http.expectOne(`${environment.apiUrl}/api/agent-token-usage/report`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(query);
    req.flush([]);
  });
});

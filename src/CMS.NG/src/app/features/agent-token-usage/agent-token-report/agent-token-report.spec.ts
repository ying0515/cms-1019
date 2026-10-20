import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { AgentTokenUsageReportRow } from '@core/models/agent-token-usage.model';
import { AgentTokenUsageService } from '@core/services/agent-token-usage.service';
import { AgentTokenReport, FILTERS_KEY } from './agent-token-report';

const ROWS: AgentTokenUsageReportRow[] = [
  {
    userId: 'jenny',
    userName: 'Jenny_Tsao',
    usageDate: '2026-10-20',
    project: 'cms-1019',
    model: 'claude-opus-5-5',
    inputTokens: 120,
    outputTokens: 45000,
    cacheWriteTokens: 380000,
    cacheReadTokens: 9100000,
    cost: null,
    unpricedCount: 2,
    sessionCount: 2,
  },
  {
    userId: 'helen',
    userName: 'helen',
    usageDate: '2026-10-19',
    project: 'other-repo',
    model: 'claude-haiku-5-5',
    inputTokens: 1,
    outputTokens: 2,
    cacheWriteTokens: 3,
    cacheReadTokens: 4,
    cost: null,
    unpricedCount: 1,
    sessionCount: 1,
  },
];

describe('AgentTokenReport', () => {
  let fixture: ComponentFixture<AgentTokenReport>;
  let component: AgentTokenReport;
  let service: jasmine.SpyObj<AgentTokenUsageService>;

  beforeEach(async () => {
    sessionStorage.clear();
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 9, 20, 10, 0, 0));

    service = jasmine.createSpyObj<AgentTokenUsageService>('AgentTokenUsageService', ['report']);
    service.report.and.returnValue(of(ROWS));

    await TestBed.configureTestingModule({
      imports: [AgentTokenReport],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        { provide: AgentTokenUsageService, useValue: service },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    sessionStorage.clear();
  });

  function create(): void {
    fixture = TestBed.createComponent(AgentTokenReport);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function headers(): string[] {
    return Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('thead th')).map((th) =>
      th.textContent!.trim(),
    );
  }

  function bodyRows(): string[][] {
    return Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('tbody tr')).map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) => td.textContent!.trim()),
    );
  }

  it('defaults the date range to the current month and queries it on load', () => {
    create();

    expect(component.filters.usageDateFrom).toBe('2026-10-01');
    expect(component.filters.usageDateTo).toBe('2026-10-20');
    expect(service.report).toHaveBeenCalledOnceWith({
      usageDateFrom: '2026-10-01',
      usageDateTo: '2026-10-20',
    });
  });

  it('search() sends the edited filters and saves them', () => {
    create();
    component.filters = { usageDateFrom: '2026-09-01', usageDateTo: null };

    component.search();

    expect(service.report).toHaveBeenCalledWith({ usageDateFrom: '2026-09-01', usageDateTo: null });
    expect(JSON.parse(sessionStorage.getItem(FILTERS_KEY)!).usageDateFrom).toBe('2026-09-01');
  });

  it('restores saved filters instead of the current-month default', () => {
    sessionStorage.setItem(
      FILTERS_KEY,
      JSON.stringify({ usageDateFrom: '2026-08-01', usageDateTo: '2026-08-31' }),
    );

    create();

    expect(service.report).toHaveBeenCalledOnceWith({
      usageDateFrom: '2026-08-01',
      usageDateTo: '2026-08-31',
    });
  });

  it('clearFilters() resets to the current month', () => {
    create();
    component.filters = { usageDateFrom: null, usageDateTo: null };

    component.clearFilters();

    expect(service.report).toHaveBeenCalledTimes(2);
    expect(service.report.calls.mostRecent().args[0]).toEqual({
      usageDateFrom: '2026-10-01',
      usageDateTo: '2026-10-20',
    });
  });

  it('renders the report columns', () => {
    create();

    expect(headers()).toEqual([
      '日期',
      '使用者',
      '專案',
      '模型',
      '輸入 Token 合計',
      '輸出 Token',
      '快取寫入 Token',
      '快取讀取 Token',
      '工作階段數',
    ]);
  });

  it('renders each row with total tokens in (input + cache write + cache read) and separators', () => {
    create();

    expect(bodyRows()).toEqual([
      [
        '2026-10-20',
        'Jenny_Tsao',
        'cms-1019',
        'claude-opus-5-5',
        '9,480,120',
        '45,000',
        '380,000',
        '9,100,000',
        '2',
      ],
      ['2026-10-19', 'helen', 'other-repo', 'claude-haiku-5-5', '8', '2', '3', '4', '1'],
    ]);
  });

  it('shows 查無資料 when nothing matches', () => {
    service.report.and.returnValue(of([]));
    create();

    expect(fixture.nativeElement.querySelector('tbody').textContent).toContain('查無資料');
  });
});

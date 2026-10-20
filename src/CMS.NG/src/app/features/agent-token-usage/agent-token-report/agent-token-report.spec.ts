import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { AgentTokenUsageReportRow } from '@core/models/agent-token-usage.model';
import { AppUserLookup } from '@core/models/lookup.model';
import { AgentTokenUsageService } from '@core/services/agent-token-usage.service';
import { LookupService } from '@core/services/lookup.service';
import { AgentTokenReport, FILTERS_KEY, PAGE_KEY, SORT_KEY } from './agent-token-report';

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

const USERS: AppUserLookup[] = [
  { userId: 'helen', userName: 'helen', isActive: true },
  { userId: 'jenny', userName: 'Jenny_Tsao', isActive: true },
];
const PROJECTS = ['cms-1019', 'other-repo'];
const MODELS = ['claude-haiku-5-5', 'claude-opus-5-5'];

/** n report rows on consecutive days with token counts 1 / 10 / 100 / 1000 and 1 session each. */
function manyRows(n: number): AgentTokenUsageReportRow[] {
  return Array.from({ length: n }, (_, i) => ({
    ...ROWS[1],
    usageDate: `2026-09-${String(i + 1).padStart(2, '0')}`,
    inputTokens: 1,
    outputTokens: 10,
    cacheWriteTokens: 100,
    cacheReadTokens: 1000,
    sessionCount: 1,
  }));
}

const NO_FILTERS = { userId: null, project: null, model: null };

describe('AgentTokenReport', () => {
  let fixture: ComponentFixture<AgentTokenReport>;
  let component: AgentTokenReport;
  let service: jasmine.SpyObj<AgentTokenUsageService>;
  let lookups: jasmine.SpyObj<LookupService>;

  beforeEach(async () => {
    sessionStorage.clear();
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 9, 20, 10, 0, 0));

    service = jasmine.createSpyObj<AgentTokenUsageService>('AgentTokenUsageService', ['report']);
    service.report.and.returnValue(of(ROWS));
    lookups = jasmine.createSpyObj<LookupService>('LookupService', [
      'getAppUsers',
      'getAgentTokenProjects',
      'getAgentTokenModels',
    ]);
    lookups.getAppUsers.and.returnValue(of(USERS));
    lookups.getAgentTokenProjects.and.returnValue(of(PROJECTS));
    lookups.getAgentTokenModels.and.returnValue(of(MODELS));

    await TestBed.configureTestingModule({
      imports: [AgentTokenReport],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        { provide: AgentTokenUsageService, useValue: service },
        { provide: LookupService, useValue: lookups },
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

  function footerCells(): string[] {
    return Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('tfoot td')).map((td) =>
      td.textContent!.trim(),
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
      ...NO_FILTERS,
    });
  });

  it('search() sends the edited filters and saves them', () => {
    create();
    component.filters = {
      usageDateFrom: '2026-09-01',
      usageDateTo: null,
      userId: null,
      project: null,
      model: null,
    };

    component.search();

    expect(service.report).toHaveBeenCalledWith({
      usageDateFrom: '2026-09-01',
      usageDateTo: null,
      ...NO_FILTERS,
    });
    expect(JSON.parse(sessionStorage.getItem(FILTERS_KEY)!).usageDateFrom).toBe('2026-09-01');
  });

  it('the filter drawer has 日期, 使用者, 專案 and 模型 and submits every filter', async () => {
    create();
    component.drawerVisible = true;
    fixture.detectChanges();
    await fixture.whenStable();

    const labels = Array.from<HTMLElement>(
      document.body.querySelectorAll('.filter-drawer label'),
    ).map((l) => l.textContent!.trim());
    expect(labels).toEqual(['日期', '使用者', '專案', '模型']);

    component.filters = {
      usageDateFrom: '2026-10-01',
      usageDateTo: '2026-10-20',
      userId: 'jenny',
      project: 'cms-1019',
      model: 'claude-opus-5-5',
    };
    document.body.querySelector<HTMLButtonElement>('.filter-drawer button[type="submit"]')!.click();

    expect(service.report.calls.mostRecent().args[0]).toEqual({
      usageDateFrom: '2026-10-01',
      usageDateTo: '2026-10-20',
      userId: 'jenny',
      project: 'cms-1019',
      model: 'claude-opus-5-5',
    });
    expect(component.activeFilterCount()).toBe(5);
    expect(component.drawerVisible).toBeFalse();
    expect(JSON.parse(sessionStorage.getItem(FILTERS_KEY)!).model).toBe('claude-opus-5-5');
  });

  it('fills the drawer options from the lookups (user label "UserId UserName")', () => {
    create();

    expect(component.userOptions).toEqual([
      { value: 'helen', label: 'helen helen' },
      { value: 'jenny', label: 'jenny Jenny_Tsao' },
    ]);
    expect(component.projectOptions).toEqual([
      { value: 'cms-1019', label: 'cms-1019' },
      { value: 'other-repo', label: 'other-repo' },
    ]);
    expect(component.modelOptions).toEqual([
      { value: 'claude-haiku-5-5', label: 'claude-haiku-5-5' },
      { value: 'claude-opus-5-5', label: 'claude-opus-5-5' },
    ]);
  });

  it('still searches when a lookup fails', () => {
    lookups.getAgentTokenModels.and.returnValue(throwError(() => new Error('down')));

    create();

    expect(service.report).toHaveBeenCalledTimes(1);
    expect(component.modelOptions).toEqual([]);
  });

  it('restores saved filters instead of the current-month default', () => {
    sessionStorage.setItem(
      FILTERS_KEY,
      JSON.stringify({
        usageDateFrom: '2026-08-01',
        usageDateTo: '2026-08-31',
        userId: 'helen',
        project: 'other-repo',
        model: 'claude-haiku-5-5',
      }),
    );

    create();

    expect(service.report).toHaveBeenCalledOnceWith({
      usageDateFrom: '2026-08-01',
      usageDateTo: '2026-08-31',
      userId: 'helen',
      project: 'other-repo',
      model: 'claude-haiku-5-5',
    });
    expect(component.filters.userId).toBe('helen');
  });

  it('restores sort and page from session storage', () => {
    service.report.and.returnValue(of(manyRows(25)));
    sessionStorage.setItem(SORT_KEY, JSON.stringify({ sortField: 'project', sortOrder: 1 }));
    sessionStorage.setItem(PAGE_KEY, JSON.stringify({ first: 10, rows: 10 }));

    create();

    expect(component.sortField).toBe('project');
    expect(component.sortOrder).toBe(1);
    expect(component.first).toBe(10);
    expect(component.rows).toBe(10);
  });

  it('clearFilters() resets to the current month and drops user, project and model', () => {
    create();
    component.filters = {
      usageDateFrom: null,
      usageDateTo: null,
      userId: 'jenny',
      project: 'cms-1019',
      model: 'claude-opus-5-5',
    };

    component.clearFilters();

    expect(service.report).toHaveBeenCalledTimes(2);
    expect(service.report.calls.mostRecent().args[0]).toEqual({
      usageDateFrom: '2026-10-01',
      usageDateTo: '2026-10-20',
      ...NO_FILTERS,
    });
  });

  it('the 合計 row sums every numeric column over all filtered rows, not just the page', () => {
    service.report.and.returnValue(of(manyRows(25)));
    sessionStorage.setItem(PAGE_KEY, JSON.stringify({ first: 0, rows: 10 }));

    create();

    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(10);
    // tokens in = 25 × (1 + 100 + 1000); output 25 × 10; cache write 25 × 100; cache read 25 × 1000
    expect(footerCells()).toEqual(['合計', '27,525', '250', '2,500', '25,000', '25']);
  });

  it('the 合計 row shows thousands separators over the sample rows', () => {
    create();

    expect(footerCells()).toEqual(['合計', '9,480,128', '45,002', '380,003', '9,100,004', '3']);
  });

  it('hides the 合計 row when nothing matches', () => {
    service.report.and.returnValue(of([]));
    create();

    expect(footerCells()).toEqual([]);
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

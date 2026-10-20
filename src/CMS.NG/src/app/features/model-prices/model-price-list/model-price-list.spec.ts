import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { ModelPriceService } from '@core/services/model-price.service';
import { HAIKU, OPUS } from '../testing/model-price.fixtures';
import { FILTERS_KEY, ModelPriceList, PAGE_KEY, SORT_KEY } from './model-price-list';

describe('ModelPriceList', () => {
  let fixture: ComponentFixture<ModelPriceList>;
  let component: ModelPriceList;
  let service: jasmine.SpyObj<ModelPriceService>;
  let confirmation: ConfirmationService;
  let messages: MessageService;

  const EMPTY_QUERY = { keyword: null, effectiveFromFrom: null, effectiveFromTo: null };

  beforeEach(async () => {
    sessionStorage.clear();
    service = jasmine.createSpyObj<ModelPriceService>('ModelPriceService', ['query', 'delete']);
    service.query.and.returnValue(of([HAIKU, OPUS]));
    service.delete.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [ModelPriceList],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        ConfirmationService,
        { provide: ModelPriceService, useValue: service },
      ],
    }).compileComponents();

    confirmation = TestBed.inject(ConfirmationService);
    messages = TestBed.inject(MessageService);
  });

  afterEach(() => sessionStorage.clear());

  function create(): void {
    fixture = TestBed.createComponent(ModelPriceList);
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
      Array.from(tr.querySelectorAll('td'))
        .slice(0, 7)
        .map((td) => td.textContent!.trim()),
    );
  }

  it('queries with empty filters on init, sorted by model', () => {
    create();

    expect(service.query).toHaveBeenCalledOnceWith(EMPTY_QUERY);
    expect(component.items().length).toBe(2);
    expect(component.sortField).toBe('model');
    expect(component.sortOrder).toBe(1);
  });

  it('renders the price columns with the USD per 1M tokens hint', () => {
    create();

    expect(headers()).toEqual([
      '主代碼',
      '模型',
      '生效日',
      '輸入單價',
      '輸出單價',
      '快取寫入單價',
      '快取讀取單價',
      '操作',
    ]);
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('美元／百萬 Token');
  });

  it('renders a row per price with 2–6 decimals', () => {
    create();

    expect(bodyRows()).toEqual([
      ['3', 'claude-haiku-5-5', '2026-01-01', '0.10', '0.50', '0.20', '0.01'],
      ['1', 'claude-opus-5-5', '2026-01-01', '4.00', '20.00', '8.00', '0.20'],
    ]);
  });

  it('shows the empty message when there are no results', () => {
    service.query.and.returnValue(of([]));
    create();

    expect(fixture.nativeElement.textContent).toContain('查無資料');
  });

  it('search() sends the trimmed keyword and date range, saves filters and resets paging', () => {
    create();
    component.first = 40;
    component.filters = {
      keyword: '  opus ',
      effectiveFromFrom: '2026-01-01',
      effectiveFromTo: '2026-12-31',
    };

    component.search();

    expect(service.query).toHaveBeenCalledWith({
      keyword: 'opus',
      effectiveFromFrom: '2026-01-01',
      effectiveFromTo: '2026-12-31',
    });
    expect(JSON.parse(sessionStorage.getItem(FILTERS_KEY)!).keyword).toBe('  opus ');
    expect(component.first).toBe(0);
    expect(component.activeFilterCount()).toBe(3);
  });

  it('treats blank filters as no filter', () => {
    create();
    component.filters = { keyword: '   ', effectiveFromFrom: '', effectiveFromTo: null };

    component.search();

    expect(service.query).toHaveBeenCalledWith(EMPTY_QUERY);
    expect(component.activeFilterCount()).toBe(0);
  });

  it('restores filters, sort and page from session storage', () => {
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ keyword: 'haiku' }));
    sessionStorage.setItem(SORT_KEY, JSON.stringify({ sortField: 'effectiveFrom', sortOrder: -1 }));
    sessionStorage.setItem(PAGE_KEY, JSON.stringify({ first: 10, rows: 10 }));

    create();

    expect(component.filters).toEqual({
      keyword: 'haiku',
      effectiveFromFrom: null,
      effectiveFromTo: null,
    });
    expect(component.sortField).toBe('effectiveFrom');
    expect(component.sortOrder).toBe(-1);
    expect(component.rows).toBe(10);
    expect(component.first).toBe(10);
    expect(service.query).toHaveBeenCalledWith({ ...EMPTY_QUERY, keyword: 'haiku' });
  });

  it('clearFilters() resets filters and re-queries', () => {
    create();
    component.filters.keyword = 'x';
    service.query.calls.reset();

    component.clearFilters();

    expect(component.filters.keyword).toBeNull();
    expect(service.query).toHaveBeenCalledOnceWith(EMPTY_QUERY);
  });

  it('persists sort and page changes', () => {
    create();

    component.onSort({ field: 'effectiveFrom', order: -1 });
    component.onPage({ first: 20, rows: 20 });

    expect(JSON.parse(sessionStorage.getItem(SORT_KEY)!)).toEqual({
      sortField: 'effectiveFrom',
      sortOrder: -1,
    });
    expect(JSON.parse(sessionStorage.getItem(PAGE_KEY)!)).toEqual({ first: 20, rows: 20 });
  });

  it('add() navigates to the new form', () => {
    create();
    const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    component.add();

    expect(nav).toHaveBeenCalledWith(['/model-prices/new']);
  });

  it('confirmDelete() names the model and date, warns about the recompute, deletes on accept and reloads', () => {
    create();
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      expect(c.message).toBe(
        '確定要刪除主代碼 <b>1</b>「&#60;b&#62;opus 2026-01-01」？<br>相關的 Token 用量成本將重新計算。',
      );
      c.accept?.();
      return confirmation;
    });
    service.query.calls.reset();

    component.confirmDelete({ ...OPUS, model: '<b>opus' });

    expect(service.delete).toHaveBeenCalledOnceWith(1);
    expect(service.query).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast when delete fails', () => {
    create();
    service.delete.and.returnValue(throwError(() => ({ status: 500 })));
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      c.accept?.();
      return confirmation;
    });
    const add = spyOn(messages, 'add');

    component.confirmDelete(OPUS);

    expect(add).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'error', summary: '刪除失敗' }),
    );
  });

  it('shows an error toast when the query fails', () => {
    service.query.and.returnValue(throwError(() => new Error('boom')));
    const add = spyOn(messages, 'add');

    create();

    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
    expect(component.loading()).toBeFalse();
  });
});

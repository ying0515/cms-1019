import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { PublishStatusService } from '@core/services/publish-status.service';
import { DRAFT_STATUS, PUBLISHED_STATUS } from '../testing/publish-status.fixtures';
import { FILTERS_KEY, PAGE_KEY, PublishStatusList, SORT_KEY } from './publish-status-list';

describe('PublishStatusList', () => {
  let fixture: ComponentFixture<PublishStatusList>;
  let component: PublishStatusList;
  let service: jasmine.SpyObj<PublishStatusService>;
  let confirmation: ConfirmationService;
  let messages: MessageService;

  beforeEach(async () => {
    sessionStorage.clear();
    service = jasmine.createSpyObj<PublishStatusService>('PublishStatusService', ['query', 'delete']);
    service.query.and.returnValue(of([DRAFT_STATUS, PUBLISHED_STATUS]));
    service.delete.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [PublishStatusList],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        ConfirmationService,
        { provide: PublishStatusService, useValue: service },
      ],
    }).compileComponents();

    confirmation = TestBed.inject(ConfirmationService);
    messages = TestBed.inject(MessageService);
  });

  afterEach(() => sessionStorage.clear());

  function create(): void {
    fixture = TestBed.createComponent(PublishStatusList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function rows(): HTMLTableRowElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('tbody tr'));
  }

  it('queries with empty filters on init, sorted by pkid', () => {
    create();

    expect(service.query).toHaveBeenCalledOnceWith({
      keyword: null,
      isDraft: null,
      isPublished: null,
      isDiscontinued: null,
    });
    expect(component.items().length).toBe(2);
    expect(component.sortField).toBe('pkid');
    expect(component.sortOrder).toBe(1);
  });

  it('renders a row per status with a check icon for set flags', () => {
    create();

    const r = rows();
    expect(r.length).toBe(2);
    expect(r[0].textContent).toContain('草稿');
    expect(r[1].textContent).toContain('已發布');
    // Draft row: only IsDraft is set
    const icons = r[0].querySelectorAll('td.text-center i');
    expect(Array.from(icons).map((i) => i.classList.contains('pi-check'))).toEqual([true, false, false]);
  });

  it('shows the empty message when there are no results', () => {
    service.query.and.returnValue(of([]));
    create();

    expect(fixture.nativeElement.textContent).toContain('查無資料');
  });

  it('search() sends trimmed keyword and bool filters, saves them and resets paging', () => {
    create();
    component.first = 40;
    component.filters = { keyword: '  發布 ', isDraft: false, isPublished: true, isDiscontinued: null };

    component.search();

    expect(service.query).toHaveBeenCalledWith({
      keyword: '發布',
      isDraft: false,
      isPublished: true,
      isDiscontinued: null,
    });
    expect(JSON.parse(sessionStorage.getItem(FILTERS_KEY)!).keyword).toBe('  發布 ');
    expect(component.first).toBe(0);
    // false counts as an applied filter
    expect(component.activeFilterCount()).toBe(3);
  });

  it('restores filters, sort and page from session storage', () => {
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ keyword: '草', isDraft: true }));
    sessionStorage.setItem(SORT_KEY, JSON.stringify({ sortField: 'description', sortOrder: -1 }));
    sessionStorage.setItem(PAGE_KEY, JSON.stringify({ first: 10, rows: 10 }));

    create();

    expect(component.filters.keyword).toBe('草');
    expect(component.filters.isDraft).toBeTrue();
    expect(component.sortField).toBe('description');
    expect(component.sortOrder).toBe(-1);
    expect(component.rows).toBe(10);
    expect(component.first).toBe(10);
    expect(service.query).toHaveBeenCalledWith(jasmine.objectContaining({ keyword: '草', isDraft: true }));
    expect(component.activeFilterCount()).toBe(2);
  });

  it('clearFilters() resets filters and re-queries', () => {
    create();
    component.filters.isPublished = true;
    service.query.calls.reset();

    component.clearFilters();

    expect(component.filters.isPublished).toBeNull();
    expect(component.activeFilterCount()).toBe(0);
    expect(service.query).toHaveBeenCalledTimes(1);
  });

  it('persists sort and page changes', () => {
    create();

    component.onSort({ field: 'description', order: -1 });
    component.onPage({ first: 20, rows: 20 });

    expect(JSON.parse(sessionStorage.getItem(SORT_KEY)!)).toEqual({ sortField: 'description', sortOrder: -1 });
    expect(JSON.parse(sessionStorage.getItem(PAGE_KEY)!)).toEqual({ first: 20, rows: 20 });
  });

  it('add() navigates to the new form', () => {
    create();
    const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    component.add();

    expect(nav).toHaveBeenCalledWith(['/publish-statuses/new']);
  });

  it('confirmDelete() shows pkid and escaped description, deletes on accept and reloads', () => {
    create();
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      expect(c.message).toBe('確定要刪除主代碼 <b>1</b>「&#60;b&#62;草稿」？');
      c.accept?.();
      return confirmation;
    });
    service.query.calls.reset();

    component.confirmDelete({ ...DRAFT_STATUS, description: '<b>草稿' });

    expect(service.delete).toHaveBeenCalledOnceWith(1);
    expect(service.query).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast when delete fails with 409 (status in use)', () => {
    create();
    service.delete.and.returnValue(throwError(() => ({ status: 409 })));
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      c.accept?.();
      return confirmation;
    });
    const add = spyOn(messages, 'add');

    component.confirmDelete(PUBLISHED_STATUS);

    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', summary: '刪除失敗' }));
  });

  it('shows an error toast when the query fails', () => {
    service.query.and.returnValue(throwError(() => new Error('boom')));
    const add = spyOn(messages, 'add');

    create();

    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
    expect(component.loading()).toBeFalse();
  });
});

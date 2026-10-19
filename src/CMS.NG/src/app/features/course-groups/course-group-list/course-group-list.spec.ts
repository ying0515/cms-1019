import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { CourseGroupService } from '@core/services/course-group.service';
import { CLOUD_GROUP, SECURITY_GROUP } from '../testing/course-group.fixtures';
import { CourseGroupList, FILTERS_KEY, PAGE_KEY, SORT_KEY } from './course-group-list';

describe('CourseGroupList', () => {
  let fixture: ComponentFixture<CourseGroupList>;
  let component: CourseGroupList;
  let service: jasmine.SpyObj<CourseGroupService>;
  let confirmation: ConfirmationService;
  let messages: MessageService;

  beforeEach(async () => {
    sessionStorage.clear();
    service = jasmine.createSpyObj<CourseGroupService>('CourseGroupService', ['query', 'delete']);
    service.query.and.returnValue(of([SECURITY_GROUP, CLOUD_GROUP]));
    service.delete.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [CourseGroupList],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        ConfirmationService,
        { provide: CourseGroupService, useValue: service },
      ],
    }).compileComponents();

    confirmation = TestBed.inject(ConfirmationService);
    messages = TestBed.inject(MessageService);
  });

  afterEach(() => sessionStorage.clear());

  function create(): void {
    fixture = TestBed.createComponent(CourseGroupList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function rows(): HTMLTableRowElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('tbody tr'));
  }

  it('queries with empty filters on init, sorted by pkid descending', () => {
    create();

    expect(service.query).toHaveBeenCalledOnceWith({ keyword: null });
    expect(component.items().length).toBe(2);
    expect(component.sortField).toBe('pkid');
    expect(component.sortOrder).toBe(-1);
  });

  it('renders a row per group', () => {
    create();

    const r = rows();
    expect(r.length).toBe(2);
    expect(r[0].textContent).toContain('資訊安全');
    expect(r[1].textContent).toContain('雲端運算');
  });

  it('shows the empty message when there are no results', () => {
    service.query.and.returnValue(of([]));
    create();

    expect(fixture.nativeElement.textContent).toContain('查無資料');
  });

  it('search() sends the trimmed keyword, saves filters and resets paging', () => {
    create();
    component.first = 40;
    component.filters = { keyword: '  雲端 ' };

    component.search();

    expect(service.query).toHaveBeenCalledWith({ keyword: '雲端' });
    expect(JSON.parse(sessionStorage.getItem(FILTERS_KEY)!).keyword).toBe('  雲端 ');
    expect(component.first).toBe(0);
    expect(component.activeFilterCount()).toBe(1);
  });

  it('treats a blank keyword as no filter', () => {
    create();
    component.filters = { keyword: '   ' };

    component.search();

    expect(service.query).toHaveBeenCalledWith({ keyword: null });
    expect(component.activeFilterCount()).toBe(0);
  });

  it('restores filters, sort and page from session storage', () => {
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ keyword: '安全' }));
    sessionStorage.setItem(SORT_KEY, JSON.stringify({ sortField: 'description', sortOrder: 1 }));
    sessionStorage.setItem(PAGE_KEY, JSON.stringify({ first: 10, rows: 10 }));

    create();

    expect(component.filters.keyword).toBe('安全');
    expect(component.sortField).toBe('description');
    expect(component.sortOrder).toBe(1);
    expect(component.rows).toBe(10);
    expect(component.first).toBe(10);
    expect(service.query).toHaveBeenCalledWith({ keyword: '安全' });
    expect(component.activeFilterCount()).toBe(1);
  });

  it('clearFilters() resets filters and re-queries', () => {
    create();
    component.filters.keyword = 'x';
    service.query.calls.reset();

    component.clearFilters();

    expect(component.filters.keyword).toBeNull();
    expect(component.activeFilterCount()).toBe(0);
    expect(service.query).toHaveBeenCalledTimes(1);
  });

  it('persists sort and page changes', () => {
    create();

    component.onSort({ field: 'description', order: 1 });
    component.onPage({ first: 20, rows: 20 });

    expect(JSON.parse(sessionStorage.getItem(SORT_KEY)!)).toEqual({
      sortField: 'description',
      sortOrder: 1,
    });
    expect(JSON.parse(sessionStorage.getItem(PAGE_KEY)!)).toEqual({ first: 20, rows: 20 });
  });

  it('add() navigates to the new form', () => {
    create();
    const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    component.add();

    expect(nav).toHaveBeenCalledWith(['/course-groups/new']);
  });

  it('confirmDelete() shows pkid and escaped description, deletes on accept and reloads', () => {
    create();
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      expect(c.message).toBe('確定要刪除主代碼 <b>2</b>「&#60;b&#62;資訊安全」？');
      c.accept?.();
      return confirmation;
    });
    service.query.calls.reset();

    component.confirmDelete({ ...SECURITY_GROUP, description: '<b>資訊安全' });

    expect(service.delete).toHaveBeenCalledOnceWith(2);
    expect(service.query).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast when delete fails with 409 (group in use)', () => {
    create();
    service.delete.and.returnValue(throwError(() => ({ status: 409 })));
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      c.accept?.();
      return confirmation;
    });
    const add = spyOn(messages, 'add');

    component.confirmDelete(CLOUD_GROUP);

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

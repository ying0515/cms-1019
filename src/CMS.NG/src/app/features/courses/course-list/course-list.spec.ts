import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { CourseService } from '@core/services/course.service';
import { LookupService } from '@core/services/lookup.service';
import { AZ104, CCNA, COURSE_GROUPS, PARTNERS, PUBLISH_STATUSES } from '../testing/course.fixtures';
import { CourseList, CourseListFilters, FILTERS_KEY, PAGE_KEY, SORT_KEY } from './course-list';

const EMPTY_QUERY = {
  keyword: null,
  partnerPkid: null,
  courseGroupPkid: null,
  publishStatusPkid: null,
  scheduleOnFrom: null,
  scheduleOnTo: null,
  scheduleOffFrom: null,
  scheduleOffTo: null,
  canRepeat: null,
};

describe('CourseList', () => {
  let fixture: ComponentFixture<CourseList>;
  let component: CourseList;
  let service: jasmine.SpyObj<CourseService>;
  let lookups: jasmine.SpyObj<LookupService>;
  let confirmation: ConfirmationService;
  let messages: MessageService;

  async function setup(queryParams: Record<string, string> = {}) {
    sessionStorage.clear();
    service = jasmine.createSpyObj<CourseService>('CourseService', ['query', 'delete']);
    service.query.and.returnValue(of([AZ104, CCNA]));
    service.delete.and.returnValue(of(void 0));
    lookups = jasmine.createSpyObj<LookupService>('LookupService', [
      'getPartners',
      'getCourseGroups',
      'getPublishStatuses',
    ]);
    lookups.getPartners.and.returnValue(of(PARTNERS));
    lookups.getCourseGroups.and.returnValue(of(COURSE_GROUPS));
    lookups.getPublishStatuses.and.returnValue(of(PUBLISH_STATUSES));

    await TestBed.configureTestingModule({
      imports: [CourseList],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        ConfirmationService,
        { provide: CourseService, useValue: service },
        { provide: LookupService, useValue: lookups },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } },
        },
      ],
    }).compileComponents();

    confirmation = TestBed.inject(ConfirmationService);
    messages = TestBed.inject(MessageService);
  }

  afterEach(() => sessionStorage.clear());

  function create(): void {
    fixture = TestBed.createComponent(CourseList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function rows(): HTMLTableRowElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('tbody tr'));
  }

  function headers(): string[] {
    return Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('thead th')).map((th) =>
      th.textContent!.trim(),
    );
  }

  describe('without query params', () => {
    beforeEach(() => setup());

    it('loads lookups, then queries with empty filters sorted by displayOrder', () => {
      create();

      expect(lookups.getPartners).toHaveBeenCalled();
      expect(lookups.getCourseGroups).toHaveBeenCalled();
      expect(lookups.getPublishStatuses).toHaveBeenCalled();
      expect(service.query).toHaveBeenCalledOnceWith(EMPTY_QUERY);
      expect(component.items().length).toBe(2);
      expect(component.sortField).toBe('displayOrder');
      expect(component.partnerOptions).toEqual([
        { pkid: 1, label: 'Microsoft' },
        { pkid: 2, label: 'Cisco' },
      ]);
    });

    it('renders the requested columns in order', () => {
      create();

      expect(headers()).toEqual([
        '主代碼',
        '顯示順序',
        '簡介代碼',
        '科目代碼',
        '課程名稱',
        '原廠',
        '課程群組',
        '上架狀態',
        '上架日期',
        '下架日期',
        '時數',
        '定價',
        '點數',
        '允許重聽',
        '操作',
      ]);
    });

    it('shows FK labels from the joined objects with links, and formats numbers', () => {
      create();

      const [az, ccna] = rows();
      expect(az.querySelector('.partner')?.textContent).toContain('Microsoft');
      expect(az.querySelector('.partner a')?.getAttribute('href')).toBe('/partners/1');
      expect(az.querySelector('.course-group')?.textContent).toContain('雲端運算');
      expect(az.querySelector('.course-group a')?.getAttribute('href')).toBe('/course-groups/1');
      expect(az.querySelector('.publish-status')?.textContent).toContain('已發布');
      expect(az.querySelector('.publish-status a')?.getAttribute('href')).toBe(
        '/publish-statuses/2',
      );
      expect(az.textContent).toContain('2026-01-01');
      expect(az.querySelector('.list-price')?.textContent).toContain('28,000');
      expect(az.querySelector('.learning-credit')?.textContent).toContain('4.0');
      expect(az.querySelector('.pi-check')).not.toBeNull();

      expect(ccna.querySelector('.course-group')?.textContent).toContain('—');
      expect(ccna.querySelector('.course-group a')).toBeNull();
      expect(ccna.querySelector('.learning-credit')?.textContent).toContain('5.5');
      expect(ccna.querySelector('.pi-check')).toBeNull();
    });

    it('shows the empty message when there are no results', () => {
      service.query.and.returnValue(of([]));
      create();

      expect(fixture.nativeElement.textContent).toContain('查無資料');
    });

    it('search() sends all filters, saves them and resets paging', () => {
      create();
      component.first = 40;
      const filters: CourseListFilters = {
        keyword: '  az ',
        partnerPkid: 1,
        courseGroupPkid: 3,
        publishStatusPkid: 2,
        scheduleOnFrom: '2026-01-01',
        scheduleOnTo: '2026-12-31',
        scheduleOffFrom: '',
        scheduleOffTo: '2036-12-31',
        canRepeat: false,
      };
      component.filters = { ...filters };

      component.search();

      expect(service.query).toHaveBeenCalledWith({
        keyword: 'az',
        partnerPkid: 1,
        courseGroupPkid: 3,
        publishStatusPkid: 2,
        scheduleOnFrom: '2026-01-01',
        scheduleOnTo: '2026-12-31',
        scheduleOffFrom: null,
        scheduleOffTo: '2036-12-31',
        canRepeat: false,
      });
      expect(JSON.parse(sessionStorage.getItem(FILTERS_KEY)!).keyword).toBe('  az ');
      expect(component.first).toBe(0);
      expect(component.activeFilterCount()).toBe(8); // canRepeat=false counts as a filter
    });

    it('treats a blank keyword as no filter', () => {
      create();
      component.filters.keyword = '   ';

      component.search();

      expect(service.query).toHaveBeenCalledWith(EMPTY_QUERY);
      expect(component.activeFilterCount()).toBe(0);
    });

    it('clearFilters() resets filters and re-queries', () => {
      create();
      component.filters.partnerPkid = 2;
      service.query.calls.reset();

      component.clearFilters();

      expect(component.filters.partnerPkid).toBeNull();
      expect(service.query).toHaveBeenCalledOnceWith(EMPTY_QUERY);
    });

    it('persists sort and page changes', () => {
      create();

      component.onSort({ field: 'partner.name', order: -1 });
      component.onPage({ first: 20, rows: 20 });

      expect(JSON.parse(sessionStorage.getItem(SORT_KEY)!)).toEqual({
        sortField: 'partner.name',
        sortOrder: -1,
      });
      expect(JSON.parse(sessionStorage.getItem(PAGE_KEY)!)).toEqual({ first: 20, rows: 20 });
    });

    it('still queries when a lookup fails', () => {
      lookups.getPartners.and.returnValue(throwError(() => new Error('boom')));
      create();

      expect(service.query).toHaveBeenCalledTimes(1);
    });

    it('add() navigates to the new form', () => {
      create();
      const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

      component.add();

      expect(nav).toHaveBeenCalledWith(['/courses/new']);
    });

    it('confirmDelete() shows pkid and escaped title, deletes on accept and reloads', () => {
      create();
      spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
        expect(c.message).toBe('確定要刪除主代碼 <b>2</b>「&#60;b&#62;CCNA」？');
        c.accept?.();
        return confirmation;
      });
      service.query.calls.reset();

      component.confirmDelete({ ...CCNA, title: '<b>CCNA' });

      expect(service.delete).toHaveBeenCalledOnceWith(2);
      expect(service.query).toHaveBeenCalledTimes(1);
    });

    it('shows an error toast when delete fails with 409 (course in use)', () => {
      create();
      service.delete.and.returnValue(throwError(() => ({ status: 409 })));
      spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
        c.accept?.();
        return confirmation;
      });
      const add = spyOn(messages, 'add');

      component.confirmDelete(AZ104);

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

  describe('session restore', () => {
    beforeEach(() => setup());

    it('restores filters, sort and page from session storage', () => {
      sessionStorage.setItem(
        FILTERS_KEY,
        JSON.stringify({ keyword: 'ccna', canRepeat: true, scheduleOnFrom: '2026-01-01' }),
      );
      sessionStorage.setItem(SORT_KEY, JSON.stringify({ sortField: 'title', sortOrder: -1 }));
      sessionStorage.setItem(PAGE_KEY, JSON.stringify({ first: 10, rows: 10 }));

      create();

      expect(component.filters.keyword).toBe('ccna');
      expect(component.sortField).toBe('title');
      expect(component.sortOrder).toBe(-1);
      expect(component.first).toBe(10);
      expect(component.rows).toBe(10);
      expect(service.query).toHaveBeenCalledWith({
        ...EMPTY_QUERY,
        keyword: 'ccna',
        canRepeat: true,
        scheduleOnFrom: '2026-01-01',
      });
      expect(component.activeFilterCount()).toBe(3);
    });
  });

  describe('with an incoming FK query param', () => {
    beforeEach(() => setup({ partnerPkid: '2' }));

    it('overrides saved filters and starts from the first page', () => {
      sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ keyword: 'old', courseGroupPkid: 1 }));
      sessionStorage.setItem(PAGE_KEY, JSON.stringify({ first: 40, rows: 20 }));

      create();

      expect(service.query).toHaveBeenCalledOnceWith({ ...EMPTY_QUERY, partnerPkid: 2 });
      expect(component.filters.keyword).toBeNull();
      expect(component.first).toBe(0);
      expect(JSON.parse(sessionStorage.getItem(FILTERS_KEY)!).partnerPkid).toBe(2);
    });
  });

  describe('with an invalid FK query param', () => {
    beforeEach(() => setup({ publishStatusPkid: 'abc' }));

    it('ignores the value but still clears saved filters', () => {
      sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ keyword: 'old' }));

      create();

      expect(service.query).toHaveBeenCalledOnceWith(EMPTY_QUERY);
    });
  });
});

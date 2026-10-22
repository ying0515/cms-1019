import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { CourseService } from '@core/services/course.service';
import { LookupService } from '@core/services/lookup.service';
import { AZ104, CCNA, COURSE_GROUPS, PARTNERS, PUBLISH_STATUSES } from '../testing/course.fixtures';
import {
  CourseList,
  CourseListFilters,
  EditableField,
  FILTERS_KEY,
  PAGE_KEY,
  SORT_KEY,
  validateCourseField,
} from './course-list';

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
    service = jasmine.createSpyObj<CourseService>('CourseService', [
      'query',
      'delete',
      'getById',
      'update',
    ]);
    service.query.and.returnValue(of([AZ104, CCNA]));
    service.getById.and.callFake((pkid) => of(pkid === AZ104.pkid ? AZ104 : CCNA));
    service.update.and.returnValue(of(void 0));
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
      // Editable cells carry no link (a double-click would navigate first); 檢視 opens the detail
      expect(az.querySelector('.publish-status a')).toBeNull();
      expect(az.querySelector('.title a')).toBeNull();
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

  describe('inline edit', () => {
    beforeEach(() => setup());

    /** Cell of the AZ-104 row (first row, sorted by displayOrder). */
    function cell(cls: string): HTMLTableCellElement {
      return rows()[0].querySelector<HTMLTableCellElement>(`td.${cls}`)!;
    }

    function dblclick(el: HTMLElement): void {
      el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      fixture.detectChanges();
    }

    /** Focus leaves `el` to outside the table (relatedTarget null). */
    function blur(el: HTMLElement, relatedTarget: EventTarget | null = null): void {
      el.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget }));
      fixture.detectChanges();
    }

    function editor(td: HTMLElement): HTMLInputElement {
      return td.querySelector('input')!;
    }

    /** Opens the editor on `cls`, sets the pending value and blurs. */
    function editAndBlur(cls: string, value: unknown): HTMLTableCellElement {
      const td = cell(cls);
      dblclick(td);
      component.editValue = value;
      // p-select renders a combobox span rather than an input
      blur(td.querySelector<HTMLElement>('input, [role="combobox"]') ?? td);
      return td;
    }

    it('double-click enters edit mode; single click does not', async () => {
      create();
      const td = cell('title');

      td.click();
      fixture.detectChanges();
      expect(component.editing()).toBeNull();
      expect(td.querySelector('input')).toBeNull();

      dblclick(td);
      await fixture.whenStable();
      expect(component.editing()).toEqual({ pkid: 1, field: 'title' });
      expect(td.classList).toContain('cell-editing');
      expect(editor(td).value).toBe('Microsoft Azure 管理員');
    });

    it('keeps 主代碼, 原廠 and 課程群組 read-only', () => {
      create();

      for (const cls of ['pkid', 'partner', 'course-group']) {
        const td = cell(cls);
        expect(td.hasAttribute('data-field')).withContext(cls).toBeFalse();
        dblclick(td);
        expect(component.editing()).withContext(cls).toBeNull();
        expect(td.querySelector('input, p-select, p-datepicker')).withContext(cls).toBeNull();
      }
    });

    it('uses the editor matching each column type', () => {
      create();
      const cases: [string, string][] = [
        ['display-order', 'p-inputnumber'],
        ['course-id', 'input[pInputText]'],
        ['prod-course-id', 'input[pInputText]'],
        ['title', 'input[pInputText]'],
        ['publish-status', 'p-select'],
        ['schedule-on', 'p-datepicker'],
        ['schedule-off', 'p-datepicker'],
        ['hour', 'p-inputnumber'],
        ['list-price', 'p-inputnumber'],
        ['learning-credit', 'p-inputnumber'],
        ['can-repeat-cell', 'p-checkbox'],
      ];

      for (const [cls, selector] of cases) {
        component.cancelEdit();
        fixture.detectChanges();
        const td = cell(cls);
        dblclick(td);
        expect(td.querySelector(selector)).withContext(cls).not.toBeNull();
      }
    });

    it('blur saves via GET + PUT of the full record (keeps n-n) and updates the row', async () => {
      create();
      const add = spyOn(messages, 'add');
      const td = cell('title');
      dblclick(td);
      await fixture.whenStable();

      const input = editor(td);
      input.value = '  Azure 管理員（新版）  ';
      input.dispatchEvent(new Event('input'));
      blur(input);

      expect(service.getById).toHaveBeenCalledOnceWith(1);
      expect(service.update).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({
          pkid: 1,
          title: 'Azure 管理員（新版）',
          courseId: 'AZ-104',
          objective: '管理 Azure 訂用帳戶',
          certificationPkids: [1],
          jobCategoryPkids: [1],
        }),
      );
      const request = service.update.calls.mostRecent().args[0] as unknown as Record<
        string,
        unknown
      >;
      expect(request['partner']).toBeUndefined();
      expect(request['certifications']).toBeUndefined();
      expect(component.editing()).toBeNull();
      expect(cell('title').textContent).toContain('Azure 管理員（新版）');
      expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'success' }));
    });

    it('saves numbers, dates, 上架狀態 (with its label) and 允許重聽', () => {
      create();
      const edits: [string, EditableField, unknown][] = [
        ['hour', 'hour', 0],
        ['list-price', 'listPrice', 30000],
        ['learning-credit', 'learningCredit', 4.5],
        ['schedule-off', 'scheduleOff', '2030-12-31'],
        ['publish-status', 'publishStatusPkid', 1],
        ['can-repeat-cell', 'canRepeat', false],
      ];

      for (const [cls, field, value] of edits) {
        service.update.calls.reset();
        editAndBlur(cls, value);
        expect(service.update)
          .withContext(field)
          .toHaveBeenCalledOnceWith(jasmine.objectContaining({ [field]: value }));
      }
      expect(cell('publish-status').textContent).toContain('草稿');
      expect(cell('can-repeat-cell').querySelector('.pi-check')).toBeNull();
    });

    it('does not save when the value is unchanged', () => {
      create();

      editAndBlur('hour', 32);

      expect(service.update).not.toHaveBeenCalled();
      expect(component.editing()).toBeNull();
    });

    it('does not commit while focus moves within the cell or into its overlay', () => {
      create();
      const td = cell('hour');
      dblclick(td);
      component.editValue = 10;

      blur(editor(td), td);
      expect(component.editing()).not.toBeNull();

      component.onOverlayShow();
      blur(editor(td));
      expect(component.editing()).not.toBeNull();
      expect(service.update).not.toHaveBeenCalled();
    });

    /** Lets pending timers (editor focus, overlay-hide check) and PrimeNG updates run. */
    async function settle(): Promise<void> {
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 20));
        fixture.detectChanges();
        await fixture.whenStable();
      }
    }

    it('picking a date in the overlay is not a blur; leaving the cell then saves it', async () => {
      create();
      const td = cell('schedule-off');
      dblclick(td);
      await settle();
      const input = editor(td);
      expect(document.activeElement).toBe(input);
      const panel = document.body.querySelector<HTMLElement>('.p-datepicker-panel');
      expect(panel).withContext('overlay opened on focus').not.toBeNull();

      // Mouse-down on the overlay moves focus out of the cell before the click lands
      input.blur();
      fixture.detectChanges();
      expect(component.editing()).not.toBeNull();
      expect(service.update).not.toHaveBeenCalled();

      const day = Array.from(
        panel!.querySelectorAll<HTMLElement>('td:not(.p-datepicker-other-month) > span'),
      ).find((s) => s.textContent!.trim() === '15')!;
      day.click();
      await settle();

      // PrimeNG refocuses the input after a pick: still editing until focus leaves the cell
      expect(component.editValue).toBe('2036-01-15');
      expect(document.body.querySelector('.p-datepicker-panel')).toBeNull();
      expect(document.activeElement).toBe(editor(td));
      expect(component.editing()).not.toBeNull();
      expect(service.update).not.toHaveBeenCalled();

      editor(td).blur();
      await settle();

      expect(service.update).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ scheduleOff: '2036-01-15' }),
      );
      expect(component.editing()).toBeNull();
      expect(cell('schedule-off').textContent).toContain('2036-01-15');
    });

    it('choosing a 上架狀態 option keeps the editor open until blur, then saves', async () => {
      create();
      const td = cell('publish-status');
      dblclick(td);
      await settle();
      const combobox = td.querySelector<HTMLElement>('[role="combobox"]')!;
      expect(document.activeElement).toBe(combobox);

      td.querySelector<HTMLElement>('.p-select')!.click();
      await settle();
      const option = Array.from(
        document.body.querySelectorAll<HTMLElement>('.p-select-overlay [role="option"]'),
      ).find((o) => o.textContent!.includes('草稿'))!;
      expect(option).withContext('overlay option').toBeDefined();
      option.click();
      await settle();

      expect(component.editValue).toBe(1);
      expect(component.editing()).not.toBeNull();
      expect(service.update).not.toHaveBeenCalled();

      (document.activeElement as HTMLElement).blur();
      await settle();

      expect(service.update).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ publishStatusPkid: 1 }),
      );
      expect(cell('publish-status').textContent).toContain('草稿');
    });

    it('Escape cancels without saving', () => {
      create();
      const td = cell('hour');
      dblclick(td);
      component.editValue = 10;

      editor(td).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(component.editing()).toBeNull();
      expect(cell('hour').textContent).toContain('32');
      expect(service.update).not.toHaveBeenCalled();
    });

    describe('validation blocks the save and keeps the cell in edit mode', () => {
      const invalid: [string, string, unknown, string][] = [
        ['required text', 'title', '   ', '請輸入課程名稱'],
        ['required text', 'course-id', '', '請輸入簡介代碼'],
        ['text too long', 'prod-course-id', 'x'.repeat(51), '最多 50 字'],
        ['required number', 'display-order', null, '請輸入顯示順序'],
        ['cleared number', 'hour', null, '請輸入時數（0 以上）'],
        ['negative number', 'hour', -1, '請輸入時數（0 以上）'],
        ['negative number', 'list-price', -100, '請輸入定價（0 以上）'],
        ['not a number', 'learning-credit', NaN, '請輸入點數（0 以上）'],
        ['negative number', 'learning-credit', -0.5, '請輸入點數（0 以上）'],
        ['fractional hour', 'hour', 1.5, '時數須為整數'],
        ['required date', 'schedule-on', null, '請選擇上架日期'],
        ['invalid date', 'schedule-on', '2026-02-30', '上架日期格式不正確'],
        ['invalid date', 'schedule-off', 'abc', '下架日期格式不正確'],
        ['上架 after 下架', 'schedule-on', '2036-01-02', '上架日期不可晚於下架日期'],
        ['下架 before 上架', 'schedule-off', '2025-12-31', '上架日期不可晚於下架日期'],
        ['required select', 'publish-status', null, '請選擇上架狀態'],
      ];

      for (const [name, cls, value, message] of invalid) {
        it(`${name}: ${cls} = ${JSON.stringify(value)}`, () => {
          create();

          const td = editAndBlur(cls, value);

          expect(service.update).not.toHaveBeenCalled();
          expect(component.editing()).not.toBeNull();
          expect(td.classList).toContain('cell-editing');
          expect(td.querySelector('.cell-error')?.textContent).toContain(message);
        });
      }
    });

    it('an invalid edit blocks opening another cell until fixed', () => {
      create();
      editAndBlur('hour', -1);

      dblclick(cell('title'));
      expect(component.editing()).toEqual({ pkid: 1, field: 'hour' });

      component.editValue = 16;
      blur(editor(cell('hour')));
      expect(component.editing()).toBeNull();
      expect(service.update).toHaveBeenCalledOnceWith(jasmine.objectContaining({ hour: 16 }));
    });

    it('accepts boundary values (0, 上架日期 = 下架日期)', () => {
      expect(validateCourseField('listPrice', 0, AZ104)).toBeNull();
      expect(validateCourseField('scheduleOn', '2036-01-01', AZ104)).toBeNull();
      expect(validateCourseField('scheduleOff', '2026-01-01', AZ104)).toBeNull();
    });

    it('reverts the cell and shows an error when the update fails', () => {
      create();
      const add = spyOn(messages, 'add');
      service.update.and.returnValue(throwError(() => ({ status: 400 })));

      editAndBlur('hour', 99);

      expect(service.update).toHaveBeenCalled();
      expect(component.items()[0].hour).toBe(32);
      expect(cell('hour').textContent).toContain('32');
      expect(add).toHaveBeenCalledWith(
        jasmine.objectContaining({ severity: 'error', summary: '更新失敗' }),
      );
    });

    it('reverts when loading the full record fails', () => {
      create();
      const add = spyOn(messages, 'add');
      service.getById.and.returnValue(throwError(() => ({ status: 404 })));

      editAndBlur('publish-status', 1);

      expect(service.update).not.toHaveBeenCalled();
      expect(cell('publish-status').textContent).toContain('已發布');
      expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ summary: '更新失敗' }));
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

import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService, SortEvent } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { DrawerModule } from 'primeng/drawer';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule, TablePageEvent } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { forkJoin, switchMap } from 'rxjs';

import { Course, CourseQuery, CourseRequest } from '@core/models/course.model';
import {
  CourseGroupLookup,
  LookupOption,
  PartnerLookup,
  PublishStatusLookup,
} from '@core/models/lookup.model';
import { CourseService } from '@core/services/course.service';
import { LookupService } from '@core/services/lookup.service';
import { parseIsoDate, toIsoDate } from '@core/utils/date.util';
import { showHttpError } from '@core/utils/http-error.util';
import { loadSession, saveSession } from '@core/utils/session-state.util';

export const FILTERS_KEY = 'course-list-filters';
export const SORT_KEY = 'course-list-sort';
export const PAGE_KEY = 'course-list-page';

/** Dates are 'yyyy-MM-dd' strings (p-datepicker dataType="string") so they persist as-is. */
export interface CourseListFilters {
  keyword: string | null;
  partnerPkid: number | null;
  courseGroupPkid: number | null;
  publishStatusPkid: number | null;
  scheduleOnFrom: string | null;
  scheduleOnTo: string | null;
  scheduleOffFrom: string | null;
  scheduleOffTo: string | null;
  canRepeat: boolean | null;
}

const EMPTY_FILTERS: CourseListFilters = {
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

/** Incoming cross-entity query params (from Partner / CourseGroup / PublishStatus pages). */
const FK_PARAMS = ['partnerPkid', 'courseGroupPkid', 'publishStatusPkid'] as const;

/**
 * List columns editable in place (double-click). 主代碼, 原廠 and 課程群組 stay read-only.
 * Dates are 'yyyy-MM-dd' strings (p-datepicker dataType="string").
 */
export type EditableField =
  | 'displayOrder'
  | 'courseId'
  | 'prodCourseId'
  | 'title'
  | 'publishStatusPkid'
  | 'scheduleOn'
  | 'scheduleOff'
  | 'hour'
  | 'listPrice'
  | 'learningCredit'
  | 'canRepeat';

const TEXT_FIELDS: Partial<Record<EditableField, { label: string; max: number }>> = {
  courseId: { label: '簡介代碼', max: 50 },
  prodCourseId: { label: '科目代碼', max: 50 },
  title: { label: '課程名稱', max: 200 },
};

/** Non-negative numbers; limits match the DB columns (smallint / decimal(9,0) / decimal(9,1)). */
const NUMBER_FIELDS: Partial<
  Record<EditableField, { label: string; max: number; integer: boolean }>
> = {
  hour: { label: '時數', max: 32767, integer: true },
  listPrice: { label: '定價', max: 999999999, integer: true },
  learningCredit: { label: '點數', max: 99999999.9, integer: false },
};

/** Validates one inline-edited value against the rest of the row; returns an error message or null. */
export function validateCourseField(
  field: EditableField,
  value: unknown,
  row: Course,
): string | null {
  const text = TEXT_FIELDS[field];
  if (text) {
    if (typeof value !== 'string' || !value.trim()) return `請輸入${text.label}`;
    return value.trim().length > text.max ? `最多 ${text.max} 字` : null;
  }
  const num = NUMBER_FIELDS[field];
  if (num) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
      return `請輸入${num.label}（0 以上）`;
    if (num.integer && !Number.isInteger(value)) return `${num.label}須為整數`;
    return value > num.max ? `${num.label}不可大於 ${num.max}` : null;
  }
  switch (field) {
    case 'displayOrder':
      return typeof value === 'number' && Number.isInteger(value) ? null : '請輸入顯示順序';
    case 'publishStatusPkid':
      return value == null ? '請選擇上架狀態' : null;
    case 'scheduleOn':
    case 'scheduleOff': {
      const label = field === 'scheduleOn' ? '上架日期' : '下架日期';
      if (value == null || value === '') return `請選擇${label}`;
      const d = typeof value === 'string' ? parseIsoDate(value) : null;
      // Rejects rolled-over dates such as 2026-02-30
      if (!d || toIsoDate(d) !== value) return `${label}格式不正確`;
      const on = field === 'scheduleOn' ? value : row.scheduleOn;
      const off = field === 'scheduleOff' ? value : row.scheduleOff;
      return on > off ? '上架日期不可晚於下架日期' : null;
    }
    default:
      return null;
  }
}

/** Response → write DTO. List rows have empty n-n, so pass a GET-by-pkid result. */
function toRequest(c: Course): CourseRequest {
  const { partner, courseGroup, publishStatus, certifications, jobCategories, ...fields } = c;
  return {
    ...fields,
    certificationPkids: certifications.map((x) => x.pkid),
    jobCategoryPkids: jobCategories.map((x) => x.pkid),
  };
}

@Component({
  selector: 'app-course-list',
  imports: [
    DecimalPipe,
    FormsModule,
    NgTemplateOutlet,
    RouterLink,
    ButtonModule,
    CheckboxModule,
    DatePickerModule,
    DrawerModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TooltipModule,
  ],
  templateUrl: './course-list.html',
  styleUrl: './course-list.scss',
})
export class CourseList implements OnInit {
  private readonly service = inject(CourseService);
  private readonly lookups = inject(LookupService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly items = signal<Course[]>([]);
  readonly loading = signal(false);
  drawerVisible = false;

  filters: CourseListFilters = { ...EMPTY_FILTERS };
  partners: PartnerLookup[] = [];
  courseGroups: CourseGroupLookup[] = [];
  publishStatuses: PublishStatusLookup[] = [];

  readonly canRepeatOptions = [
    { label: '是', value: true },
    { label: '否', value: false },
  ];

  sortField = 'displayOrder';
  sortOrder = 1;
  first = 0;
  rows = 20;
  readonly rowsPerPageOptions = [10, 20, 50, 100];

  /** Number of filters applied by the last search (not the unsubmitted drawer edits). */
  readonly activeFilterCount = signal(0);

  /** Cell in inline-edit mode, its pending value and validation error. */
  readonly editing = signal<{ pkid: number; field: EditableField } | null>(null);
  readonly editError = signal<string | null>(null);
  editValue: unknown = null;
  /** A select / datepicker overlay (appended to body) is open, so focus leaving the cell isn't a blur. */
  private overlayOpen = false;

  get partnerOptions(): LookupOption<number>[] {
    return this.partners.map((p) => ({ pkid: p.pkid, label: p.name }));
  }

  get courseGroupOptions(): LookupOption<number>[] {
    return this.courseGroups.map((g) => ({ pkid: g.pkid, label: g.description }));
  }

  get publishStatusOptions(): LookupOption<number>[] {
    return this.publishStatuses.map((s) => ({ pkid: s.pkid, label: s.description }));
  }

  ngOnInit(): void {
    const sort = loadSession<{ sortField: string; sortOrder: number }>(SORT_KEY);
    if (sort) {
      this.sortField = sort.sortField;
      this.sortOrder = sort.sortOrder;
    }
    const page = loadSession<{ first: number; rows: number }>(PAGE_KEY);
    if (page) {
      this.first = page.first;
      this.rows = page.rows;
    }

    // Restore filters after lookups load
    forkJoin({
      partners: this.lookups.getPartners(),
      courseGroups: this.lookups.getCourseGroups(),
      publishStatuses: this.lookups.getPublishStatuses(),
    }).subscribe({
      next: (l) => {
        this.partners = l.partners;
        this.courseGroups = l.courseGroups;
        this.publishStatuses = l.publishStatuses;
        this.restoreFiltersAndSearch();
      },
      error: () => this.restoreFiltersAndSearch(),
    });
  }

  private restoreFiltersAndSearch(): void {
    // An incoming FK query param replaces the saved filters and starts from page 1
    const params = this.route.snapshot.queryParamMap;
    const incoming = FK_PARAMS.filter((k) => params.has(k));
    if (incoming.length) {
      this.filters = { ...EMPTY_FILTERS };
      for (const k of incoming) {
        const v = Number(params.get(k));
        if (Number.isInteger(v) && v > 0) this.filters[k] = v;
      }
      this.search();
      return;
    }

    const saved = loadSession<CourseListFilters>(FILTERS_KEY);
    if (saved) this.filters = { ...EMPTY_FILTERS, ...saved };
    this.search(false);
  }

  search(resetPage = true): void {
    if (resetPage) {
      this.first = 0;
      this.savePage();
    }
    saveSession(FILTERS_KEY, this.filters);

    const f = this.filters;
    const query: CourseQuery = {
      keyword: f.keyword?.trim() || null,
      partnerPkid: f.partnerPkid,
      courseGroupPkid: f.courseGroupPkid,
      publishStatusPkid: f.publishStatusPkid,
      scheduleOnFrom: f.scheduleOnFrom || null,
      scheduleOnTo: f.scheduleOnTo || null,
      scheduleOffFrom: f.scheduleOffFrom || null,
      scheduleOffTo: f.scheduleOffTo || null,
      canRepeat: f.canRepeat,
    };
    this.activeFilterCount.set(
      Object.values(query).filter((v) => v !== null && v !== undefined && v !== '').length,
    );

    this.loading.set(true);
    this.service.query(query).subscribe({
      next: (data) => {
        this.items.set(data);
        this.loading.set(false);
        this.drawerVisible = false;
      },
      error: (err) => {
        this.loading.set(false);
        showHttpError(this.messages, '查詢失敗', err);
      },
    });
  }

  clearFilters(): void {
    this.filters = { ...EMPTY_FILTERS };
    this.search();
  }

  onSort(event: SortEvent): void {
    if (!event.field) return;
    this.sortField = event.field;
    this.sortOrder = event.order ?? 1;
    saveSession(SORT_KEY, { sortField: this.sortField, sortOrder: this.sortOrder });
  }

  onPage(event: TablePageEvent): void {
    this.first = event.first;
    this.rows = event.rows;
    this.savePage();
  }

  private savePage(): void {
    saveSession(PAGE_KEY, { first: this.first, rows: this.rows });
  }

  add(): void {
    this.router.navigate(['/courses/new']);
  }

  confirmDelete(item: Course): void {
    this.confirm.confirm({
      header: '刪除確認',
      message: `確定要刪除主代碼 <b>${item.pkid}</b>「${escapeHtml(item.title)}」？`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.delete(item),
    });
  }

  private delete(item: Course): void {
    this.service.delete(item.pkid).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: '已刪除', detail: item.title });
        this.search(false);
      },
      error: (err) =>
        showHttpError(this.messages, '刪除失敗', err),
    });
  }

  // Inline edit

  isEditing(item: Course, field: EditableField): boolean {
    const e = this.editing();
    return e?.pkid === item.pkid && e.field === field;
  }

  /** Double-click on a `td[data-field]` opens its editor; cells without it are read-only. */
  onCellDblClick(event: MouseEvent, item: Course): void {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('td[data-field]');
    if (cell) this.startEdit(item, cell.dataset['field'] as EditableField);
  }

  startEdit(item: Course, field: EditableField): void {
    if (this.isEditing(item, field)) return;
    // An invalid pending edit keeps its cell open
    if (!this.commitEdit()) return;
    this.editing.set({ pkid: item.pkid, field });
    this.editValue = item[field];
    this.editError.set(null);
    this.overlayOpen = false;
    setTimeout(() => this.focusEditor());
  }

  cancelEdit(): void {
    this.editing.set(null);
    this.editError.set(null);
    this.overlayOpen = false;
  }

  /** Blur: focus left the editing cell, and not into its overlay. */
  onEditorFocusOut(event: FocusEvent): void {
    const cell = this.editingCell();
    if (!cell || this.overlayOpen || !cell.contains(event.target as Node)) return;
    if (cell.contains(event.relatedTarget as Node | null)) return;
    this.commitEdit();
  }

  onOverlayShow(): void {
    this.overlayOpen = true;
  }

  /** Focus may have left the cell while the overlay was open (e.g. a date picked with the mouse). */
  onOverlayHide(): void {
    this.overlayOpen = false;
    setTimeout(() => {
      const cell = this.editingCell();
      if (cell && !cell.contains(document.activeElement)) this.commitEdit();
    });
  }

  /** Validates and saves the pending edit; returns false (cell stays open) when invalid. */
  commitEdit(): boolean {
    const e = this.editing();
    if (!e) return true;
    const item = this.items().find((c) => c.pkid === e.pkid);
    if (!item) {
      this.cancelEdit();
      return true;
    }
    const value = typeof this.editValue === 'string' ? this.editValue.trim() : this.editValue;
    const error = validateCourseField(e.field, value, item);
    if (error) {
      this.editError.set(error);
      return false;
    }
    this.cancelEdit();
    if (value !== item[e.field]) this.saveField(item, e.field, value);
    return true;
  }

  /** Optimistic update, then PUT the fresh full record (keeps n-n); reverts the cell on failure. */
  private saveField(item: Course, field: EditableField, value: unknown): void {
    const previous = item[field];
    this.patchItem(item.pkid, field, value);
    this.service
      .getById(item.pkid)
      .pipe(switchMap((current) => this.service.update(toRequest({ ...current, [field]: value }))))
      .subscribe({
        next: () =>
          this.messages.add({ severity: 'success', summary: '已更新', detail: item.title }),
        error: (err) => {
          this.patchItem(item.pkid, field, previous);
          showHttpError(this.messages, '更新失敗', err);
        },
      });
  }

  private patchItem(pkid: number, field: EditableField, value: unknown): void {
    this.items.update((list) =>
      list.map((c) => {
        if (c.pkid !== pkid) return c;
        const patched: Course = { ...c, [field]: value };
        if (field === 'publishStatusPkid')
          patched.publishStatus = this.publishStatuses.find((s) => s.pkid === value) ?? null;
        return patched;
      }),
    );
  }

  private editingCell(): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>('td.cell-editing');
  }

  private focusEditor(): void {
    this.editingCell()
      ?.querySelector<HTMLElement>('[role="combobox"], input:not([type="hidden"])')
      ?.focus();
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

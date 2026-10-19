import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService, SortEvent } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule, TablePageEvent } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { forkJoin } from 'rxjs';

import { Course, CourseQuery } from '@core/models/course.model';
import {
  CourseGroupLookup,
  LookupOption,
  PartnerLookup,
  PublishStatusLookup,
} from '@core/models/lookup.model';
import { CourseService } from '@core/services/course.service';
import { LookupService } from '@core/services/lookup.service';
import { httpErrorMessage } from '@core/utils/http-error.util';
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

@Component({
  selector: 'app-course-list',
  imports: [
    DecimalPipe,
    FormsModule,
    RouterLink,
    ButtonModule,
    DatePickerModule,
    DrawerModule,
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
        this.messages.add({
          severity: 'error',
          summary: '查詢失敗',
          detail: httpErrorMessage(err),
        });
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
        this.messages.add({
          severity: 'error',
          summary: '刪除失敗',
          detail: httpErrorMessage(err),
        }),
    });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

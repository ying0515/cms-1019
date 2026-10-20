import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService, SortEvent } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DrawerModule } from 'primeng/drawer';
import { SelectModule } from 'primeng/select';
import { TableModule, TablePageEvent } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { Observable, catchError, of } from 'rxjs';

import {
  AgentTokenUsageReportQuery,
  AgentTokenUsageReportRow,
} from '@core/models/agent-token-usage.model';
import { AgentTokenUsageService } from '@core/services/agent-token-usage.service';
import { LookupService } from '@core/services/lookup.service';
import { toIsoDate } from '@core/utils/date.util';
import { showHttpError } from '@core/utils/http-error.util';
import { loadSession, saveSession } from '@core/utils/session-state.util';

export const FILTERS_KEY = 'agent-token-report-filters';
export const SORT_KEY = 'agent-token-report-sort';
export const PAGE_KEY = 'agent-token-report-page';

/** Dates are 'yyyy-MM-dd' strings (p-datepicker dataType="string") so they persist as-is. */
export interface AgentTokenReportFilters {
  usageDateFrom: string | null;
  usageDateTo: string | null;
  userId: string | null;
  project: string | null;
  model: string | null;
}

/** A report row plus tokens in = input + cache write + cache read (a field, so it sorts). */
export interface AgentTokenReportViewRow extends AgentTokenUsageReportRow {
  totalInputTokens: number;
}

/** String-valued p-select option. */
export interface SelectOption {
  value: string;
  label: string;
}

/** Numeric columns the 合計 row adds up; a new numeric column only needs adding here. */
export const TOTAL_FIELDS = [
  'totalInputTokens',
  'outputTokens',
  'cacheWriteTokens',
  'cacheReadTokens',
  'cost',
  'sessionCount',
] as const;
export type TotalField = (typeof TOTAL_FIELDS)[number];

/** First day of the current month → today (local dates); everyone, every project and model. */
function defaultFilters(): AgentTokenReportFilters {
  const today = new Date();
  return {
    usageDateFrom: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    usageDateTo: toIsoDate(today),
    userId: null,
    project: null,
    model: null,
  };
}

/** A failed lookup leaves its dropdown empty instead of blocking the report. */
function orEmpty<T>(source: Observable<T[]>): Observable<T[]> {
  return source.pipe(catchError(() => of([] as T[])));
}

function toOptions(values: string[]): SelectOption[] {
  return values.map((v) => ({ value: v, label: v }));
}

@Component({
  selector: 'app-agent-token-report',
  imports: [
    DecimalPipe,
    FormsModule,
    ButtonModule,
    DatePickerModule,
    DrawerModule,
    SelectModule,
    TableModule,
    TooltipModule,
  ],
  templateUrl: './agent-token-report.html',
  styleUrl: './agent-token-report.scss',
})
export class AgentTokenReport implements OnInit {
  private readonly service = inject(AgentTokenUsageService);
  private readonly lookups = inject(LookupService);
  private readonly messages = inject(MessageService);

  readonly items = signal<AgentTokenReportViewRow[]>([]);
  readonly loading = signal(false);
  drawerVisible = false;

  filters: AgentTokenReportFilters = defaultFilters();

  userOptions: SelectOption[] = [];
  projectOptions: SelectOption[] = [];
  modelOptions: SelectOption[] = [];

  sortField = 'usageDate';
  sortOrder = -1;
  first = 0;
  rows = 20;
  readonly rowsPerPageOptions = [10, 20, 50, 100];

  /** Number of filters applied by the last search (not the unsubmitted drawer edits). */
  readonly activeFilterCount = signal(0);

  /** 合計 over every filtered row (all pages, not just the visible one). */
  readonly totals = computed(() => {
    const sums = Object.fromEntries(TOTAL_FIELDS.map((f) => [f, 0])) as Record<TotalField, number>;
    for (const row of this.items()) {
      for (const f of TOTAL_FIELDS) sums[f] += row[f] ?? 0;
    }
    return sums;
  });

  /** Whether the 合計 cost covers any / every usage row (drives 未定價 and the partial warning). */
  readonly totalsPricing = computed(() => ({
    anyPriced: this.items().some((r) => r.cost !== null),
    anyUnpriced: this.items().some((r) => r.unpricedCount > 0),
  }));

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

    // The report doesn't depend on the dropdown options, so it doesn't wait for them
    orEmpty(this.lookups.getAppUsers()).subscribe(
      (users) =>
        (this.userOptions = users.map((u) => ({
          value: u.userId,
          label: `${u.userId} ${u.userName}`,
        }))),
    );
    orEmpty(this.lookups.getAgentTokenProjects()).subscribe(
      (projects) => (this.projectOptions = toOptions(projects)),
    );
    orEmpty(this.lookups.getAgentTokenModels()).subscribe(
      (models) => (this.modelOptions = toOptions(models)),
    );

    const saved = loadSession<Partial<AgentTokenReportFilters>>(FILTERS_KEY);
    if (saved) this.filters = { ...defaultFilters(), ...saved };
    this.search(false);
  }

  search(resetPage = true): void {
    if (resetPage) {
      this.first = 0;
      this.savePage();
    }
    saveSession(FILTERS_KEY, this.filters);

    const f = this.filters;
    const query: AgentTokenUsageReportQuery = {
      usageDateFrom: f.usageDateFrom || null,
      usageDateTo: f.usageDateTo || null,
      userId: f.userId || null,
      project: f.project || null,
      model: f.model || null,
    };
    this.activeFilterCount.set(
      Object.values(query).filter((v) => v !== null && v !== undefined && v !== '').length,
    );

    this.loading.set(true);
    this.service.report(query).subscribe({
      next: (data) => {
        this.items.set(
          data.map((r) => ({
            ...r,
            totalInputTokens: r.inputTokens + r.cacheWriteTokens + r.cacheReadTokens,
          })),
        );
        this.loading.set(false);
        this.drawerVisible = false;
      },
      error: (err) => {
        this.loading.set(false);
        showHttpError(this.messages, '查詢失敗', err);
      },
    });
  }

  /** Back to the default (current month, no user / project / model). */
  clearFilters(): void {
    this.filters = defaultFilters();
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
}

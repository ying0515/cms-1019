import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService, SortEvent } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DrawerModule } from 'primeng/drawer';
import { TableModule, TablePageEvent } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';

import {
  AgentTokenUsageReportQuery,
  AgentTokenUsageReportRow,
} from '@core/models/agent-token-usage.model';
import { AgentTokenUsageService } from '@core/services/agent-token-usage.service';
import { toIsoDate } from '@core/utils/date.util';
import { httpErrorMessage } from '@core/utils/http-error.util';
import { loadSession, saveSession } from '@core/utils/session-state.util';

export const FILTERS_KEY = 'agent-token-report-filters';
export const SORT_KEY = 'agent-token-report-sort';
export const PAGE_KEY = 'agent-token-report-page';

/** Dates are 'yyyy-MM-dd' strings (p-datepicker dataType="string") so they persist as-is. */
export interface AgentTokenReportFilters {
  usageDateFrom: string | null;
  usageDateTo: string | null;
}

/** A report row plus tokens in = input + cache write + cache read (a field, so it sorts). */
export interface AgentTokenReportViewRow extends AgentTokenUsageReportRow {
  totalInputTokens: number;
}

/** First day of the current month → today (local dates). */
function currentMonth(): AgentTokenReportFilters {
  const today = new Date();
  return {
    usageDateFrom: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    usageDateTo: toIsoDate(today),
  };
}

@Component({
  selector: 'app-agent-token-report',
  imports: [
    DecimalPipe,
    FormsModule,
    ButtonModule,
    DatePickerModule,
    DrawerModule,
    TableModule,
    TooltipModule,
  ],
  templateUrl: './agent-token-report.html',
  styleUrl: './agent-token-report.scss',
})
export class AgentTokenReport implements OnInit {
  private readonly service = inject(AgentTokenUsageService);
  private readonly messages = inject(MessageService);

  readonly items = signal<AgentTokenReportViewRow[]>([]);
  readonly loading = signal(false);
  drawerVisible = false;

  filters: AgentTokenReportFilters = currentMonth();

  sortField = 'usageDate';
  sortOrder = -1;
  first = 0;
  rows = 20;
  readonly rowsPerPageOptions = [10, 20, 50, 100];

  /** Number of filters applied by the last search (not the unsubmitted drawer edits). */
  readonly activeFilterCount = signal(0);

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

    const saved = loadSession<AgentTokenReportFilters>(FILTERS_KEY);
    if (saved) this.filters = { ...currentMonth(), ...saved };
    this.search(false);
  }

  search(resetPage = true): void {
    if (resetPage) {
      this.first = 0;
      this.savePage();
    }
    saveSession(FILTERS_KEY, this.filters);

    const query: AgentTokenUsageReportQuery = {
      usageDateFrom: this.filters.usageDateFrom || null,
      usageDateTo: this.filters.usageDateTo || null,
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
        this.messages.add({
          severity: 'error',
          summary: '查詢失敗',
          detail: httpErrorMessage(err),
        });
      },
    });
  }

  /** Back to the default range (current month). */
  clearFilters(): void {
    this.filters = currentMonth();
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

import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService, SortEvent } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule, TablePageEvent } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';

import { ModelPrice, ModelPriceQuery } from '@core/models/model-price.model';
import { ModelPriceService } from '@core/services/model-price.service';
import { showHttpError } from '@core/utils/http-error.util';
import { loadSession, saveSession } from '@core/utils/session-state.util';

export const FILTERS_KEY = 'model-price-list-filters';
export const SORT_KEY = 'model-price-list-sort';
export const PAGE_KEY = 'model-price-list-page';

/** Dates are 'yyyy-MM-dd' strings (p-datepicker dataType="string") so they persist as-is. */
export interface ModelPriceListFilters {
  keyword: string | null;
  effectiveFromFrom: string | null;
  effectiveFromTo: string | null;
}

const EMPTY_FILTERS: ModelPriceListFilters = {
  keyword: null,
  effectiveFromFrom: null,
  effectiveFromTo: null,
};

@Component({
  selector: 'app-model-price-list',
  imports: [
    DecimalPipe,
    FormsModule,
    RouterLink,
    ButtonModule,
    DatePickerModule,
    DrawerModule,
    InputTextModule,
    TableModule,
    TooltipModule,
  ],
  templateUrl: './model-price-list.html',
  styleUrl: './model-price-list.scss',
})
export class ModelPriceList implements OnInit {
  private readonly service = inject(ModelPriceService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  readonly items = signal<ModelPrice[]>([]);
  readonly loading = signal(false);
  drawerVisible = false;

  filters: ModelPriceListFilters = { ...EMPTY_FILTERS };

  // The API returns Model ASC, EffectiveFrom DESC; the stable client sort on model keeps that order
  sortField = 'model';
  sortOrder = 1;
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

    // No FK lookups to wait for
    const saved = loadSession<ModelPriceListFilters>(FILTERS_KEY);
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
    const query: ModelPriceQuery = {
      keyword: f.keyword?.trim() || null,
      effectiveFromFrom: f.effectiveFromFrom || null,
      effectiveFromTo: f.effectiveFromTo || null,
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
    this.router.navigate(['/model-prices/new']);
  }

  confirmDelete(item: ModelPrice): void {
    this.confirm.confirm({
      header: '刪除確認',
      message:
        `確定要刪除主代碼 <b>${item.pkid}</b>「${escapeHtml(item.model)} ${item.effectiveFrom}」？` +
        '<br>相關的 Token 用量成本將重新計算。',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.delete(item),
    });
  }

  private delete(item: ModelPrice): void {
    this.service.delete(item.pkid).subscribe({
      next: () => {
        this.messages.add({
          severity: 'success',
          summary: '已刪除',
          detail: `${item.model} ${item.effectiveFrom}`,
        });
        this.search(false);
      },
      error: (err) =>
        showHttpError(this.messages, '刪除失敗', err),
    });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

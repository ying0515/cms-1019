import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService, SortEvent } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule, TablePageEvent } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';

import { Partner, PartnerQuery } from '@core/models/partner.model';
import { PartnerService } from '@core/services/partner.service';
import { httpErrorMessage } from '@core/utils/http-error.util';
import { loadSession, saveSession } from '@core/utils/session-state.util';

export const FILTERS_KEY = 'partner-list-filters';
export const SORT_KEY = 'partner-list-sort';
export const PAGE_KEY = 'partner-list-page';

export interface PartnerListFilters {
  keyword: string | null;
}

const EMPTY_FILTERS: PartnerListFilters = { keyword: null };

@Component({
  selector: 'app-partner-list',
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    DrawerModule,
    InputTextModule,
    TableModule,
    TooltipModule,
  ],
  templateUrl: './partner-list.html',
  styleUrl: './partner-list.scss',
})
export class PartnerList implements OnInit {
  private readonly service = inject(PartnerService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  readonly items = signal<Partner[]>([]);
  readonly loading = signal(false);
  drawerVisible = false;

  filters: PartnerListFilters = { ...EMPTY_FILTERS };

  sortField = 'displayOrder';
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
    const saved = loadSession<PartnerListFilters>(FILTERS_KEY);
    if (saved) this.filters = { ...EMPTY_FILTERS, ...saved };
    this.search(false);
  }

  search(resetPage = true): void {
    if (resetPage) {
      this.first = 0;
      this.savePage();
    }
    saveSession(FILTERS_KEY, this.filters);

    const query: PartnerQuery = {
      keyword: this.filters.keyword?.trim() || null,
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
    this.router.navigate(['/partners/new']);
  }

  confirmDelete(item: Partner): void {
    this.confirm.confirm({
      header: '刪除確認',
      message: `確定要刪除主代碼 <b>${item.pkid}</b>「${escapeHtml(item.name)}」？`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.delete(item),
    });
  }

  private delete(item: Partner): void {
    this.service.delete(item.pkid).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: '已刪除', detail: item.name });
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

import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule, TablePageEvent } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { SortEvent } from 'primeng/api';

import { AppUser, AppUserQuery } from '@core/models/app-user.model';
import { AppRoleLookup, LookupOption } from '@core/models/lookup.model';
import { AppUserService } from '@core/services/app-user.service';
import { LookupService } from '@core/services/lookup.service';
import { showHttpError } from '@core/utils/http-error.util';
import { loadSession, saveSession } from '@core/utils/session-state.util';

export const FILTERS_KEY = 'app-user-list-filters';
export const SORT_KEY = 'app-user-list-sort';
export const PAGE_KEY = 'app-user-list-page';

export interface AppUserListFilters {
  keyword: string | null;
  isActive: boolean | null;
  roleId: string | null;
}

const EMPTY_FILTERS: AppUserListFilters = {
  keyword: null,
  isActive: null,
  roleId: null,
};

@Component({
  selector: 'app-app-user-list',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    ButtonModule,
    DrawerModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TooltipModule,
  ],
  templateUrl: './app-user-list.html',
  styleUrl: './app-user-list.scss',
})
export class AppUserList implements OnInit {
  private readonly service = inject(AppUserService);
  private readonly lookups = inject(LookupService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  readonly items = signal<AppUser[]>([]);
  readonly loading = signal(false);
  drawerVisible = false;

  filters: AppUserListFilters = { ...EMPTY_FILTERS };
  appRoles: AppRoleLookup[] = [];

  /** Tri-state options for bool filters; clearing the select means 全部 (null). */
  readonly boolOptions: LookupOption<boolean>[] = [
    { pkid: true, label: '是' },
    { pkid: false, label: '否' },
  ];

  sortField = 'userId';
  sortOrder = 1;
  first = 0;
  rows = 20;
  readonly rowsPerPageOptions = [10, 20, 50, 100];

  get roleOptions(): LookupOption<string>[] {
    return this.appRoles.map((r) => ({ pkid: r.roleId, label: `${r.roleName} (${r.roleId})` }));
  }

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

    // Restore filters after lookups load
    this.lookups.getAppRoles().subscribe({
      next: (roles) => {
        this.appRoles = roles;
        this.restoreFiltersAndSearch();
      },
      error: () => this.restoreFiltersAndSearch(),
    });
  }

  private restoreFiltersAndSearch(): void {
    const saved = loadSession<AppUserListFilters>(FILTERS_KEY);
    if (saved) this.filters = { ...EMPTY_FILTERS, ...saved };
    this.search(false);
  }

  search(resetPage = true): void {
    if (resetPage) {
      this.first = 0;
      this.savePage();
    }
    saveSession(FILTERS_KEY, this.filters);

    const query: AppUserQuery = {
      keyword: this.filters.keyword?.trim() || null,
      isActive: this.filters.isActive,
      roleId: this.filters.roleId,
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
    this.router.navigate(['/app-users/new']);
  }

  confirmDelete(item: AppUser): void {
    this.confirm.confirm({
      header: '刪除確認',
      message: `確定要刪除主代碼 <b>${item.pkid}</b>「${escapeHtml(item.userName)}」？`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.delete(item),
    });
  }

  private delete(item: AppUser): void {
    this.service.delete(item.pkid).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: '已刪除', detail: item.userId });
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

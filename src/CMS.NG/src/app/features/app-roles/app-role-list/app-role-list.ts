import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule, TablePageEvent } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { SortEvent } from 'primeng/api';

import { AppRole, AppRoleQuery } from '@core/models/app-role.model';
import { AppUserLookup, LookupOption } from '@core/models/lookup.model';
import { AppRoleService } from '@core/services/app-role.service';
import { LookupService } from '@core/services/lookup.service';
import { httpErrorMessage } from '@core/utils/http-error.util';
import { loadSession, saveSession } from '@core/utils/session-state.util';

export const FILTERS_KEY = 'app-role-list-filters';
export const SORT_KEY = 'app-role-list-sort';
export const PAGE_KEY = 'app-role-list-page';

export interface AppRoleListFilters {
  keyword: string | null;
  permissionLevelFrom: number | null;
  permissionLevelTo: number | null;
  userId: string | null;
}

const EMPTY_FILTERS: AppRoleListFilters = {
  keyword: null,
  permissionLevelFrom: null,
  permissionLevelTo: null,
  userId: null,
};

@Component({
  selector: 'app-app-role-list',
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    DrawerModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TooltipModule,
  ],
  templateUrl: './app-role-list.html',
  styleUrl: './app-role-list.scss',
})
export class AppRoleList implements OnInit {
  private readonly service = inject(AppRoleService);
  private readonly lookups = inject(LookupService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  readonly items = signal<AppRole[]>([]);
  readonly loading = signal(false);
  drawerVisible = false;

  filters: AppRoleListFilters = { ...EMPTY_FILTERS };
  appUsers: AppUserLookup[] = [];

  sortField = 'roleId';
  sortOrder = 1;
  first = 0;
  rows = 20;
  readonly rowsPerPageOptions = [10, 20, 50, 100];

  get userOptions(): LookupOption<string>[] {
    return this.appUsers.map((u) => ({ pkid: u.userId, label: `${u.userName} (${u.userId})` }));
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
    this.lookups.getAppUsers().subscribe({
      next: (users) => {
        this.appUsers = users;
        this.restoreFiltersAndSearch();
      },
      error: () => this.restoreFiltersAndSearch(),
    });
  }

  private restoreFiltersAndSearch(): void {
    const saved = loadSession<AppRoleListFilters>(FILTERS_KEY);
    if (saved) this.filters = { ...EMPTY_FILTERS, ...saved };
    this.search(false);
  }

  search(resetPage = true): void {
    if (resetPage) {
      this.first = 0;
      this.savePage();
    }
    saveSession(FILTERS_KEY, this.filters);

    const query: AppRoleQuery = {
      keyword: this.filters.keyword?.trim() || null,
      permissionLevelFrom: this.filters.permissionLevelFrom,
      permissionLevelTo: this.filters.permissionLevelTo,
      userId: this.filters.userId,
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
        this.messages.add({ severity: 'error', summary: '查詢失敗', detail: httpErrorMessage(err) });
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
    this.router.navigate(['/app-roles/new']);
  }

  confirmDelete(item: AppRole): void {
    this.confirm.confirm({
      header: '刪除確認',
      message: `確定要刪除主代碼 <b>${item.pkid}</b>「${escapeHtml(item.roleId)}」？`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => this.delete(item),
    });
  }

  private delete(item: AppRole): void {
    this.service.delete(item.pkid).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: '已刪除', detail: item.roleId });
        this.search(false);
      },
      error: (err) =>
        this.messages.add({ severity: 'error', summary: '刪除失敗', detail: httpErrorMessage(err) }),
    });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

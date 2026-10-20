import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Dialog } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { Subscription } from 'rxjs';

import { RowAuditEntry } from '@core/models/row-audit.model';
import { RowAuditService } from '@core/services/row-audit.service';
import { formatApiDateTime } from '@core/utils/date.util';

const ACTION_LABELS: Record<string, string> = { Insert: '新增', Update: '修改', Delete: '刪除' };

/**
 * Toolbar badge for one record's RowAudit history: shows the latest change inline and opens the full
 * trail (newest first) in a dialog. Place it next to the page title of detail / edit pages:
 * `<app-row-audit-badge tableName="Course" [pkid]="item.pkid" />` (tableName = the DB table name).
 */
@Component({
  selector: 'app-row-audit-badge',
  imports: [Dialog, TableModule],
  templateUrl: './row-audit-badge.html',
  styleUrl: './row-audit-badge.scss',
})
export class RowAuditBadgeComponent {
  private readonly service = inject(RowAuditService);

  readonly tableName = input.required<string>();
  readonly pkid = input.required<number | string>();

  readonly history = signal<RowAuditEntry[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly dialogOpen = signal(false);
  /** The API returns newest first. */
  readonly latest = computed(() => this.history()[0] ?? null);

  private request?: Subscription;

  constructor() {
    // Reloads if the page reuses the badge for another record
    effect((onCleanup) => {
      const tableName = this.tableName();
      const pkid = this.pkid();
      untracked(() => this.load(tableName, pkid));
      onCleanup(() => this.request?.unsubscribe());
    });
  }

  open(): void {
    this.dialogOpen.set(true);
  }

  actionLabel(actionType: string): string {
    return ACTION_LABELS[actionType] ?? actionType;
  }

  actionClass(actionType: string): string {
    return `action action-${actionType.toLowerCase()}`;
  }

  formatTime(dateTime: string): string {
    return formatApiDateTime(dateTime);
  }

  /** Update rows list property names as 'A,B'; add a space so long lists wrap. */
  formatDesc(entry: RowAuditEntry): string {
    const desc = entry.actionDesc ?? '';
    return entry.actionType === 'Update' ? desc.split(',').join(', ') : desc;
  }

  private load(tableName: string, pkid: number | string): void {
    this.loading.set(true);
    this.failed.set(false);
    this.request = this.service.getHistory(tableName, pkid).subscribe({
      next: (rows) => {
        this.history.set(rows);
        this.loading.set(false);
      },
      // No toast: the badge sits on every page and history is secondary to the page itself
      error: () => {
        this.history.set([]);
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }
}

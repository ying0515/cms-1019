import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

import { RowAuditBadgeComponent } from '@core/row-audit/row-audit-badge';
import { PublishStatus } from '@core/models/publish-status.model';
import { PublishStatusService } from '@core/services/publish-status.service';
import { showHttpError } from '@core/utils/http-error.util';

@Component({
  selector: 'app-publish-status-detail',
  imports: [RowAuditBadgeComponent, ButtonModule, TagModule],
  templateUrl: './publish-status-detail.html',
  styleUrl: './publish-status-detail.scss',
})
export class PublishStatusDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(PublishStatusService);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  readonly item = signal<PublishStatus | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);

  ngOnInit(): void {
    // pkid is tinyint (0–255)
    const id = this.route.snapshot.paramMap.get('id');
    const pkid = id === null || id.trim() === '' ? NaN : Number(id);
    if (!Number.isInteger(pkid) || pkid < 0 || pkid > 255) {
      this.loading.set(false);
      this.notFound.set(true);
      return;
    }

    this.service.getById(pkid).subscribe({
      next: (data) => {
        this.item.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notFound.set(true);
        if (err?.status !== 404) {
          showHttpError(this.messages, '載入失敗', err);
        }
      },
    });
  }

  back(): void {
    this.router.navigate(['/publish-statuses']);
  }

  edit(): void {
    const item = this.item();
    if (item) this.router.navigate(['/publish-statuses', item.pkid, 'edit']);
  }

  viewCourses(): void {
    const item = this.item();
    if (item) this.router.navigate(['/courses'], { queryParams: { publishStatusPkid: item.pkid } });
  }

  confirmDelete(): void {
    const item = this.item();
    if (!item) return;
    this.confirm.confirm({
      header: '刪除確認',
      message: `確定要刪除主代碼 <b>${item.pkid}</b>「${item.description.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)}」？`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () =>
        this.service.delete(item.pkid).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: '已刪除', detail: item.description });
            this.back();
          },
          error: (err) =>
            showHttpError(this.messages, '刪除失敗', err),
        }),
    });
  }
}

import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';

import { RowAuditBadgeComponent } from '@core/row-audit/row-audit-badge';
import { Partner } from '@core/models/partner.model';
import { PartnerService } from '@core/services/partner.service';
import { showHttpError } from '@core/utils/http-error.util';

@Component({
  selector: 'app-partner-detail',
  imports: [RowAuditBadgeComponent, ButtonModule],
  templateUrl: './partner-detail.html',
  styleUrl: './partner-detail.scss',
})
export class PartnerDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(PartnerService);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  readonly item = signal<Partner | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);

  ngOnInit(): void {
    // pkid is smallint IDENTITY (1–32767)
    const id = this.route.snapshot.paramMap.get('id');
    const pkid = id === null || id.trim() === '' ? NaN : Number(id);
    if (!Number.isInteger(pkid) || pkid < 1 || pkid > 32767) {
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
    this.router.navigate(['/partners']);
  }

  edit(): void {
    const item = this.item();
    if (item) this.router.navigate(['/partners', item.pkid, 'edit']);
  }

  viewCourses(): void {
    const item = this.item();
    if (item) this.router.navigate(['/courses'], { queryParams: { partnerPkid: item.pkid } });
  }

  confirmDelete(): void {
    const item = this.item();
    if (!item) return;
    this.confirm.confirm({
      header: '刪除確認',
      message: `確定要刪除主代碼 <b>${item.pkid}</b>「${item.name.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)}」？`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () =>
        this.service.delete(item.pkid).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: '已刪除', detail: item.name });
            this.back();
          },
          error: (err) =>
            showHttpError(this.messages, '刪除失敗', err),
        }),
    });
  }
}

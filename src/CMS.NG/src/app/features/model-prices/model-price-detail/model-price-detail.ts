import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';

import { RowAuditBadgeComponent } from '@core/row-audit/row-audit-badge';
import { ModelPrice } from '@core/models/model-price.model';
import { ModelPriceService } from '@core/services/model-price.service';
import { showHttpError } from '@core/utils/http-error.util';

@Component({
  selector: 'app-model-price-detail',
  imports: [RowAuditBadgeComponent, DecimalPipe, ButtonModule],
  templateUrl: './model-price-detail.html',
  styleUrl: './model-price-detail.scss',
})
export class ModelPriceDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ModelPriceService);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  readonly item = signal<ModelPrice | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);

  ngOnInit(): void {
    // pkid is int IDENTITY
    const id = this.route.snapshot.paramMap.get('id');
    const pkid = id === null || id.trim() === '' ? NaN : Number(id);
    if (!Number.isInteger(pkid) || pkid < 1 || pkid > 2147483647) {
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
    this.router.navigate(['/model-prices']);
  }

  edit(): void {
    const item = this.item();
    if (item) this.router.navigate(['/model-prices', item.pkid, 'edit']);
  }

  confirmDelete(): void {
    const item = this.item();
    if (!item) return;
    const model = item.model.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    this.confirm.confirm({
      header: '刪除確認',
      message:
        `確定要刪除主代碼 <b>${item.pkid}</b>「${model} ${item.effectiveFrom}」？` +
        '<br>相關的 Token 用量成本將重新計算。',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () =>
        this.service.delete(item.pkid).subscribe({
          next: () => {
            this.messages.add({
              severity: 'success',
              summary: '已刪除',
              detail: `${item.model} ${item.effectiveFrom}`,
            });
            this.back();
          },
          error: (err) =>
            showHttpError(this.messages, '刪除失敗', err),
        }),
    });
  }
}

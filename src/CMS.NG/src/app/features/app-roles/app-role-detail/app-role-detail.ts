import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

import { AppRole } from '@core/models/app-role.model';
import { AppRoleService } from '@core/services/app-role.service';
import { httpErrorMessage } from '@core/utils/http-error.util';

@Component({
  selector: 'app-app-role-detail',
  imports: [ButtonModule, TagModule],
  templateUrl: './app-role-detail.html',
  styleUrl: './app-role-detail.scss',
})
export class AppRoleDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(AppRoleService);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  readonly item = signal<AppRole | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);

  ngOnInit(): void {
    const pkid = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(pkid) || pkid <= 0) {
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
          this.messages.add({ severity: 'error', summary: '載入失敗', detail: httpErrorMessage(err) });
        }
      },
    });
  }

  back(): void {
    void this.router.navigate(['/app-roles']);
  }

  edit(): void {
    const item = this.item();
    if (item) void this.router.navigate(['/app-roles', item.pkid, 'edit']);
  }

  confirmDelete(): void {
    const item = this.item();
    if (!item) return;
    this.confirm.confirm({
      header: '刪除確認',
      message: `確定要刪除主代碼 <b>${item.pkid}</b>「${item.roleId.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)}」？`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () =>
        this.service.delete(item.pkid).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: '已刪除', detail: item.roleId });
            this.back();
          },
          error: (err) =>
            this.messages.add({ severity: 'error', summary: '刪除失敗', detail: httpErrorMessage(err) }),
        }),
    });
  }
}

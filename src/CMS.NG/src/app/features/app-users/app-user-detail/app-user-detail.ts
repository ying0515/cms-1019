import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

import { AuthService } from '@core/auth/auth.service';
import { AppUser } from '@core/models/app-user.model';
import { AppUserService } from '@core/services/app-user.service';
import { httpErrorMessage } from '@core/utils/http-error.util';

@Component({
  selector: 'app-app-user-detail',
  imports: [DatePipe, ButtonModule, TagModule],
  templateUrl: './app-user-detail.html',
  styleUrl: './app-user-detail.scss',
})
export class AppUserDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(AppUserService);
  private readonly confirm = inject(ConfirmationService);
  private readonly messages = inject(MessageService);
  private readonly auth = inject(AuthService);

  /** 重設密碼 is Admin only (the API answers 403 to anyone else). */
  readonly canResetPassword = this.auth.hasRole('Admin');
  readonly item = signal<AppUser | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);

  ngOnInit(): void {
    const pkid = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(pkid) || pkid <= 0) {
      this.loading.set(false);
      this.notFound.set(true);
      return;
    }
    this.load(pkid);
  }

  private load(pkid: number): void {
    this.service.getById(pkid).subscribe({
      next: (data) => {
        this.item.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notFound.set(true);
        if (err?.status !== 404) {
          this.messages.add({
            severity: 'error',
            summary: '載入失敗',
            detail: httpErrorMessage(err),
          });
        }
      },
    });
  }

  back(): void {
    this.router.navigate(['/app-users']);
  }

  edit(): void {
    const item = this.item();
    if (item) this.router.navigate(['/app-users', item.pkid, 'edit']);
  }

  viewRoles(): void {
    const item = this.item();
    if (item) this.router.navigate(['/app-roles'], { queryParams: { userId: item.userId } });
  }

  confirmResetPassword(): void {
    const item = this.item();
    if (!item) return;
    this.confirm.confirm({
      header: '重設密碼',
      message: `確定要將使用者 <b>${escapeHtml(item.userId)}</b> 的密碼重設為系統預設密碼？`,
      icon: 'pi pi-key',
      acceptLabel: '重設',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'warn' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () =>
        this.service.resetPassword(item.userId).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: '已重設密碼', detail: item.userId });
            this.load(item.pkid);
          },
          error: (err) =>
            this.messages.add({
              severity: 'error',
              summary: '重設失敗',
              detail: httpErrorMessage(err),
            }),
        }),
    });
  }

  confirmDelete(): void {
    const item = this.item();
    if (!item) return;
    this.confirm.confirm({
      header: '刪除確認',
      message: `確定要刪除主代碼 <b>${item.pkid}</b>「${escapeHtml(item.userName)}」？`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () =>
        this.service.delete(item.pkid).subscribe({
          next: () => {
            this.messages.add({ severity: 'success', summary: '已刪除', detail: item.userId });
            this.back();
          },
          error: (err) =>
            this.messages.add({
              severity: 'error',
              summary: '刪除失敗',
              detail: httpErrorMessage(err),
            }),
        }),
    });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

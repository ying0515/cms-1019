import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { Observable, forkJoin, of } from 'rxjs';

import { RowAuditBadgeComponent } from '@core/row-audit/row-audit-badge';
import { AuthService } from '@core/auth/auth.service';
import { AppUser, AppUserRequest } from '@core/models/app-user.model';
import { AppRoleLookup, LookupOption } from '@core/models/lookup.model';
import { AppUserService } from '@core/services/app-user.service';
import { LookupService } from '@core/services/lookup.service';
import { showHttpError } from '@core/utils/http-error.util';

@Component({
  selector: 'app-app-user-form',
  imports: [
    RowAuditBadgeComponent,
    ReactiveFormsModule,
    ButtonModule,
    CheckboxModule,
    InputTextModule,
    MultiSelectModule,
  ],
  templateUrl: './app-user-form.html',
  styleUrl: './app-user-form.scss',
})
export class AppUserForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(AppUserService);
  private readonly lookups = inject(LookupService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly auth = inject(AuthService);

  /** 重設為預設密碼: edit mode, Admin only (the API answers 403 to anyone else). */
  readonly canResetPassword: boolean;
  readonly resetting = signal(false);
  readonly isEdit: boolean;
  readonly pkid: number;
  readonly loading = signal(true);
  readonly saving = signal(false);
  appRoles: AppRoleLookup[] = [];

  // No password control: PasswordHash is managed by the backend only.
  readonly form = this.fb.nonNullable.group({
    userId: ['', [Validators.required, Validators.maxLength(200)]],
    userName: ['', [Validators.required, Validators.maxLength(200)]],
    isActive: [true],
    roleIds: this.fb.nonNullable.control<string[]>([]),
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    this.pkid = id ? Number(id) : 0;
    this.isEdit = this.pkid > 0;
    this.canResetPassword = this.isEdit && this.auth.hasRole('Admin');
  }

  get roleOptions(): LookupOption<string>[] {
    return this.appRoles.map((r) => ({ pkid: r.roleId, label: `${r.roleName} (${r.roleId})` }));
  }

  ngOnInit(): void {
    if (this.isEdit) this.form.controls.userId.disable();

    const user$: Observable<AppUser | null> = this.isEdit
      ? this.service.getById(this.pkid)
      : of(null);

    forkJoin({ roles: this.lookups.getAppRoles(), user: user$ }).subscribe({
      next: ({ roles, user }) => {
        this.appRoles = roles;
        if (user) {
          this.form.patchValue({
            userId: user.userId,
            userName: user.userName,
            isActive: user.isActive,
            roleIds: user.roles.map((r) => r.roleId),
          });
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showHttpError(this.messages, '載入失敗', err);
      },
    });
  }

  isInvalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }

  cancel(): void {
    if (this.isEdit) this.router.navigate(['/app-users', this.pkid]);
    else this.router.navigate(['/app-users']);
  }

  /** Resets the edited user's password to the system default; only the UserId is sent. Unsaved form edits stay. */
  confirmResetPassword(): void {
    const userId = this.form.controls.userId.value;
    if (!this.canResetPassword || !userId) return;
    this.confirm.confirm({
      header: '重設為預設密碼',
      message: `確定要將使用者 <b>${escapeHtml(userId)}</b> 的密碼重設為系統預設密碼？`,
      icon: 'pi pi-key',
      acceptLabel: '重設',
      rejectLabel: '取消',
      acceptButtonProps: { severity: 'warn' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => {
        this.resetting.set(true);
        this.service.resetPassword(userId).subscribe({
          next: () => {
            this.resetting.set(false);
            this.messages.add({ severity: 'success', summary: '已重設密碼', detail: userId });
          },
          error: (err) => {
            this.resetting.set(false);
            showHttpError(this.messages, '重設失敗', err);
          },
        });
      },
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const request: AppUserRequest = {
      pkid: this.pkid,
      userId: v.userId.trim(),
      userName: v.userName.trim(),
      isActive: v.isActive,
      roleIds: v.roleIds,
    };

    this.saving.set(true);
    const op$: Observable<unknown> = this.isEdit
      ? this.service.update(request)
      : this.service.create(request);
    op$.subscribe({
      next: (result) => {
        this.saving.set(false);
        this.messages.add({ severity: 'success', summary: '已儲存', detail: request.userId });
        const pkid = this.isEdit ? this.pkid : (result as AppUser).pkid;
        this.router.navigate(['/app-users', pkid]);
      },
      error: (err) => {
        this.saving.set(false);
        showHttpError(this.messages, '儲存失敗', err);
      },
    });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

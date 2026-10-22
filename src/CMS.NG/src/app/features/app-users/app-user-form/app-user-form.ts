import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { Observable, forkJoin, of } from 'rxjs';

import { AppUser, AppUserRequest } from '@core/models/app-user.model';
import { AppRoleLookup, LookupOption } from '@core/models/lookup.model';
import { AppUserService } from '@core/services/app-user.service';
import { LookupService } from '@core/services/lookup.service';
import { httpErrorMessage } from '@core/utils/http-error.util';

@Component({
  selector: 'app-app-user-form',
  imports: [ReactiveFormsModule, ButtonModule, CheckboxModule, InputTextModule, MultiSelectModule],
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
        this.messages.add({
          severity: 'error',
          summary: '載入失敗',
          detail: httpErrorMessage(err),
        });
      },
    });
  }

  isInvalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }

  cancel(): void {
    if (this.isEdit) void this.router.navigate(['/app-users', this.pkid]);
    else void this.router.navigate(['/app-users']);
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
        void this.router.navigate(['/app-users', pkid]);
      },
      error: (err) => {
        this.saving.set(false);
        this.messages.add({
          severity: 'error',
          summary: '儲存失敗',
          detail: httpErrorMessage(err),
        });
      },
    });
  }
}

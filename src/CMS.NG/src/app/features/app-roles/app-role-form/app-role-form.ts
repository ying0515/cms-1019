import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { TextareaModule } from 'primeng/textarea';
import { Observable, forkJoin, of } from 'rxjs';

import { AppRole, AppRoleRequest } from '@core/models/app-role.model';
import { AppUserLookup, LookupOption } from '@core/models/lookup.model';
import { AppRoleService } from '@core/services/app-role.service';
import { LookupService } from '@core/services/lookup.service';
import { httpErrorMessage } from '@core/utils/http-error.util';

@Component({
  selector: 'app-app-role-form',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputNumberModule,
    InputTextModule,
    MultiSelectModule,
    TextareaModule,
  ],
  templateUrl: './app-role-form.html',
  styleUrl: './app-role-form.scss',
})
export class AppRoleForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(AppRoleService);
  private readonly lookups = inject(LookupService);
  private readonly messages = inject(MessageService);

  readonly isEdit: boolean;
  readonly pkid: number;
  readonly loading = signal(true);
  readonly saving = signal(false);
  appUsers: AppUserLookup[] = [];

  readonly form = this.fb.nonNullable.group({
    roleId: ['', [Validators.required, Validators.maxLength(200)]],
    roleName: ['', [Validators.required, Validators.maxLength(200)]],
    permissionLevel: this.fb.control<number | null>(100, [Validators.required]),
    description: this.fb.control<string | null>(null, [Validators.maxLength(400)]),
    userIds: this.fb.nonNullable.control<string[]>([]),
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    this.pkid = id ? Number(id) : 0;
    this.isEdit = this.pkid > 0;
  }

  get userOptions(): LookupOption<string>[] {
    return this.appUsers.map((u) => ({ pkid: u.userId, label: `${u.userName} (${u.userId})` }));
  }

  ngOnInit(): void {
    if (this.isEdit) this.form.controls.roleId.disable();

    const role$: Observable<AppRole | null> = this.isEdit ? this.service.getById(this.pkid) : of(null);

    forkJoin({ users: this.lookups.getAppUsers(), role: role$ }).subscribe({
      next: ({ users, role }) => {
        this.appUsers = users;
        if (role) {
          this.form.patchValue({
            roleId: role.roleId,
            roleName: role.roleName,
            permissionLevel: role.permissionLevel,
            description: role.description,
            userIds: role.users.map((u) => u.userId),
          });
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.messages.add({ severity: 'error', summary: '載入失敗', detail: httpErrorMessage(err) });
      },
    });
  }

  isInvalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }

  cancel(): void {
    if (this.isEdit) void this.router.navigate(['/app-roles', this.pkid]);
    else void this.router.navigate(['/app-roles']);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const request: AppRoleRequest = {
      pkid: this.pkid,
      roleId: v.roleId.trim(),
      roleName: v.roleName.trim(),
      permissionLevel: v.permissionLevel ?? 100,
      description: v.description?.trim() || null,
      userIds: v.userIds,
    };

    this.saving.set(true);
    const op$: Observable<unknown> = this.isEdit ? this.service.update(request) : this.service.create(request);
    op$.subscribe({
      next: (result) => {
        this.saving.set(false);
        this.messages.add({ severity: 'success', summary: '已儲存', detail: request.roleId });
        const pkid = this.isEdit ? this.pkid : (result as AppRole).pkid;
        void this.router.navigate(['/app-roles', pkid]);
      },
      error: (err) => {
        this.saving.set(false);
        this.messages.add({ severity: 'error', summary: '儲存失敗', detail: httpErrorMessage(err) });
      },
    });
  }
}

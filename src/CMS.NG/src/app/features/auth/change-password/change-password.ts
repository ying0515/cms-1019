import { Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';

import { safeReturnUrl } from '@core/auth/return-url';
import { AuthService } from '@core/services/auth.service';
import { httpErrorMessage } from '@core/utils/http-error.util';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const { newPassword, confirmPassword } = group.value as Record<string, string>;
  return confirmPassword && newPassword !== confirmPassword ? { mismatch: true } : null;
}

@Component({
  selector: 'app-change-password',
  imports: [ReactiveFormsModule, ButtonModule, PasswordModule],
  templateUrl: './change-password.html',
  styleUrl: './change-password.scss',
})
export class ChangePassword {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly messages = inject(MessageService);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  /** Forced change: no 取消, since every other page is blocked until it is done. */
  readonly forced = computed(() => !!this.auth.user()?.mustChangePassword);

  readonly form = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required, Validators.maxLength(128)]],
      newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  isInvalid(name: 'currentPassword' | 'newPassword' | 'confirmPassword'): boolean {
    const c = this.form.controls[name];
    const mismatch = name === 'confirmPassword' && this.form.hasError('mismatch');
    return (c.invalid || mismatch) && (c.dirty || c.touched);
  }

  newPasswordError(): string {
    const c = this.form.controls.newPassword;
    if (c.hasError('required')) return '請輸入新密碼';
    return '新密碼須為 8 到 128 字';
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { currentPassword, newPassword } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.auth.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.saving.set(false);
        this.messages.add({ severity: 'success', summary: '成功', detail: '密碼已變更' });
        this.router.navigateByUrl(this.returnUrl());
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(httpErrorMessage(err, '變更密碼失敗，請稍後再試'));
      },
    });
  }

  cancel(): void {
    this.router.navigateByUrl(this.returnUrl());
  }

  logout(): void {
    this.auth.logout().subscribe(() => this.router.navigate(['/login']));
  }

  private returnUrl(): string {
    return safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
  }
}

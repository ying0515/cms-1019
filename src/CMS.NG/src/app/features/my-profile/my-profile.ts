import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';

import { AuthService } from '@core/auth/auth.service';
import { httpErrorMessage } from '@core/utils/http-error.util';
import {
  PASSWORD_POLICY_MESSAGE_EN,
  PASSWORD_POLICY_MESSAGE_ZH,
  passwordPolicyValidator,
  passwordsMatchValidator,
} from '@core/utils/password-policy';

type PasswordField = 'currentPassword' | 'newPassword' | 'confirmPassword';

/** 我的資料: the signed-in user edits their own UserName and password; UserId and roles are read-only. */
@Component({
  selector: 'app-my-profile',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, TagModule],
  templateUrl: './my-profile.html',
  styleUrl: './my-profile.scss',
})
export class MyProfile {
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  protected readonly auth = inject(AuthService);

  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    userName: [
      this.auth.profile()?.userName ?? '',
      [Validators.required, Validators.maxLength(200), notBlank],
    ],
  });

  // ---- 變更密碼 ----

  readonly policyZh = PASSWORD_POLICY_MESSAGE_ZH;
  readonly policyEn = PASSWORD_POLICY_MESSAGE_EN;
  readonly changingPassword = signal(false);
  /** API rejection (e.g. 目前密碼不正確), shown above the button. */
  readonly passwordError = signal<string | null>(null);

  readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, passwordPolicyValidator]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatchValidator('newPassword', 'confirmPassword') },
  );

  isPasswordInvalid(name: PasswordField): boolean {
    const c = this.passwordForm.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }

  showMismatch(): boolean {
    const confirm = this.passwordForm.controls.confirmPassword;
    return this.passwordForm.hasError('passwordMismatch') && (confirm.dirty || confirm.touched);
  }

  changePassword(): void {
    this.passwordError.set(null);
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    this.changingPassword.set(true);
    this.auth.changePassword(this.passwordForm.getRawValue()).subscribe({
      next: () => {
        this.changingPassword.set(false);
        this.passwordForm.reset();
        this.messages.add({ severity: 'success', summary: '密碼已變更' });
      },
      error: (err) => {
        this.changingPassword.set(false);
        this.passwordError.set(httpErrorMessage(err, '變更密碼失敗，請稍後再試'));
      },
    });
  }

  isInvalid(): boolean {
    const c = this.form.controls.userName;
    return c.invalid && (c.dirty || c.touched);
  }

  /** Puts back the saved name. */
  cancel(): void {
    this.form.reset({ userName: this.auth.profile()?.userName ?? '' });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.auth.updateProfile(this.form.getRawValue().userName.trim()).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.form.reset({ userName: res.userName });
        this.messages.add({ severity: 'success', summary: '已儲存', detail: res.userName });
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

/** Whitespace-only counts as empty (the API trims, then requires a value). */
function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value && !control.value.trim() ? { blank: true } : null;
}

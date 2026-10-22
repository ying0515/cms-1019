import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';

import { safeReturnUrl } from '@core/auth/return-url';
import { AuthService } from '@core/services/auth.service';
import { httpErrorMessage } from '@core/utils/http-error.util';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, PasswordModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    userId: ['', [Validators.required, Validators.maxLength(200)]],
    password: ['', [Validators.required, Validators.maxLength(128)]],
  });

  isInvalid(name: 'userId' | 'password'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.auth.login(this.form.getRawValue()).subscribe({
      next: (user) => {
        this.saving.set(false);
        const returnUrl = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
        if (user.mustChangePassword) {
          void this.router.navigate(['/change-password'], { queryParams: { returnUrl } });
        } else {
          void this.router.navigateByUrl(returnUrl);
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.form.controls.password.reset();
        this.error.set(httpErrorMessage(err, '登入失敗，請稍後再試'));
      },
    });
  }
}

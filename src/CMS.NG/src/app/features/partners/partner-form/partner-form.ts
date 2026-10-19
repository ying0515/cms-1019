import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { Observable } from 'rxjs';

import { Partner, PartnerRequest } from '@core/models/partner.model';
import { PartnerService } from '@core/services/partner.service';
import { httpErrorMessage } from '@core/utils/http-error.util';

/** Rejects whitespace-only values (Validators.required accepts them). */
const notBlank = Validators.pattern(/\S/);

@Component({
  selector: 'app-partner-form',
  imports: [ReactiveFormsModule, ButtonModule, InputNumberModule, InputTextModule],
  templateUrl: './partner-form.html',
  styleUrl: './partner-form.scss',
})
export class PartnerForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(PartnerService);
  private readonly messages = inject(MessageService);

  readonly isEdit: boolean;
  /** Route pkid in edit mode (IDENTITY, so 0 in add mode). */
  readonly pkid: number;
  readonly loading = signal(true);
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, notBlank, Validators.maxLength(50)]],
    appKey: ['', [Validators.required, notBlank, Validators.maxLength(10)]],
    nameOnPartnerMenu: ['', [Validators.required, notBlank, Validators.maxLength(200)]],
    nameOnCourseDetailPage: ['', [Validators.required, notBlank, Validators.maxLength(50)]],
    displayOrder: this.fb.control<number | null>(0, Validators.required),
    imageFilename: ['', Validators.maxLength(50)],
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    this.isEdit = id !== null;
    this.pkid = id !== null ? Number(id) : 0;
  }

  ngOnInit(): void {
    if (!this.isEdit) {
      this.loading.set(false);
      return;
    }

    this.service.getById(this.pkid).subscribe({
      next: (p: Partner) => {
        this.form.patchValue({
          name: p.name,
          appKey: p.appKey,
          nameOnPartnerMenu: p.nameOnPartnerMenu,
          nameOnCourseDetailPage: p.nameOnCourseDetailPage,
          displayOrder: p.displayOrder,
          imageFilename: p.imageFilename ?? '',
        });
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

  /** Error text for a required string field: max length wins over required/blank. */
  textError(name: keyof typeof this.form.controls, label: string, max: number): string {
    return this.form.controls[name].hasError('maxlength') ? `最多 ${max} 字` : `請輸入${label}`;
  }

  cancel(): void {
    if (this.isEdit) this.router.navigate(['/partners', this.pkid]);
    else this.router.navigate(['/partners']);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const request: PartnerRequest = {
      pkid: this.pkid,
      name: v.name.trim(),
      appKey: v.appKey.trim(),
      nameOnPartnerMenu: v.nameOnPartnerMenu.trim(),
      nameOnCourseDetailPage: v.nameOnCourseDetailPage.trim(),
      displayOrder: v.displayOrder!,
      imageFilename: v.imageFilename.trim() || null,
    };

    this.saving.set(true);
    const op$: Observable<Partner | void> = this.isEdit
      ? this.service.update(request)
      : this.service.create(request);
    op$.subscribe({
      next: (created) => {
        this.saving.set(false);
        this.messages.add({ severity: 'success', summary: '已儲存', detail: request.name });
        this.router.navigate(['/partners', created ? created.pkid : this.pkid]);
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

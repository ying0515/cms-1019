import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { Observable } from 'rxjs';

import { ModelPrice, ModelPriceRequest } from '@core/models/model-price.model';
import { ModelPriceService } from '@core/services/model-price.service';
import { parseIsoDate, toIsoDate } from '@core/utils/date.util';
import { httpErrorMessage } from '@core/utils/http-error.util';

/** Rejects whitespace-only values (Validators.required accepts them). */
const notBlank = Validators.pattern(/\S/);

const price = [Validators.required, Validators.min(0)];

@Component({
  selector: 'app-model-price-form',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DatePickerModule,
    InputNumberModule,
    InputTextModule,
  ],
  templateUrl: './model-price-form.html',
  styleUrl: './model-price-form.scss',
})
export class ModelPriceForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ModelPriceService);
  private readonly messages = inject(MessageService);

  readonly isEdit: boolean;
  /** Route pkid in edit mode (IDENTITY, so 0 in add mode). */
  readonly pkid: number;
  readonly loading = signal(true);
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    model: ['', [Validators.required, notBlank, Validators.maxLength(100)]],
    effectiveFrom: this.fb.control<Date | null>(null, Validators.required),
    inputPrice: this.fb.control<number | null>(null, price),
    outputPrice: this.fb.control<number | null>(null, price),
    cacheWritePrice: this.fb.control<number | null>(null, price),
    cacheReadPrice: this.fb.control<number | null>(null, price),
  });

  /** Price fields in display order (all USD per 1M tokens). */
  readonly priceFields = [
    { name: 'inputPrice', label: '輸入單價' },
    { name: 'outputPrice', label: '輸出單價' },
    { name: 'cacheWritePrice', label: '快取寫入單價' },
    { name: 'cacheReadPrice', label: '快取讀取單價' },
  ] as const;

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
      next: (p: ModelPrice) => {
        this.form.patchValue({
          model: p.model,
          effectiveFrom: parseIsoDate(p.effectiveFrom),
          inputPrice: p.inputPrice,
          outputPrice: p.outputPrice,
          cacheWritePrice: p.cacheWritePrice,
          cacheReadPrice: p.cacheReadPrice,
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
    if (this.isEdit) this.router.navigate(['/model-prices', this.pkid]);
    else this.router.navigate(['/model-prices']);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const request: ModelPriceRequest = {
      pkid: this.pkid,
      model: v.model.trim(),
      effectiveFrom: toIsoDate(v.effectiveFrom!),
      inputPrice: v.inputPrice!,
      outputPrice: v.outputPrice!,
      cacheWritePrice: v.cacheWritePrice!,
      cacheReadPrice: v.cacheReadPrice!,
    };

    this.saving.set(true);
    const op$: Observable<ModelPrice | void> = this.isEdit
      ? this.service.update(request)
      : this.service.create(request);
    op$.subscribe({
      next: (created) => {
        this.saving.set(false);
        this.messages.add({
          severity: 'success',
          summary: '已儲存',
          detail: `${request.model} ${request.effectiveFrom}`,
        });
        this.router.navigate(['/model-prices', created ? created.pkid : this.pkid]);
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

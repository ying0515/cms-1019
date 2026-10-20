import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MessageService } from 'primeng/api';
import {
  AutoCompleteCompleteEvent,
  AutoCompleteModule,
  AutoCompleteSelectEvent,
} from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Observable } from 'rxjs';

import {
  FeaturedPromoItem,
  FeaturedPromoItemRequest,
} from '@core/models/featured-promo-item.model';
import { PromotionLookup } from '@core/models/lookup.model';
import { FeaturedPromoItemService } from '@core/services/featured-promo-item.service';
import { LookupService } from '@core/services/lookup.service';
import { httpErrorMessage } from '@core/utils/http-error.util';

/** Rejects whitespace-only values (Validators.required accepts them). */
const notBlank = Validators.pattern(/\S/);

/** The PromoCode box must hold a looked-up Promotion2 row, not just typed text. */
function promotionSelected(c: AbstractControl): ValidationErrors | null {
  const v = c.value as PromotionLookup | string | null;
  return v && typeof v === 'object' && v.pkid > 0 ? null : { promotion: true };
}

/** What the inline form edits: an existing row (pkid > 0) or a new / pasted one (pkid 0). */
export interface FeaturedPromoItemDraft {
  pkid: number;
  /** 'yyyy-MM-dd' */
  scheduleOn: string;
  trainingCenterPkid: number;
  slot: number;
  promotion: PromotionLookup | null;
  topic: string;
  description: string;
}

/** Inline Edit / New form shown in place of a slot row on the weekly schedule. */
@Component({
  selector: 'app-featured-promo-item-form',
  imports: [ReactiveFormsModule, AutoCompleteModule, ButtonModule, InputTextModule],
  templateUrl: './featured-promo-item-form.html',
  styleUrl: './featured-promo-item-form.scss',
})
export class FeaturedPromoItemForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(FeaturedPromoItemService);
  private readonly lookups = inject(LookupService);
  private readonly messages = inject(MessageService);

  readonly draft = input.required<FeaturedPromoItemDraft>();
  /** Emits the created row on create, nothing on update. */
  readonly saved = output<FeaturedPromoItem | void>();
  readonly cancelled = output<void>();

  readonly saving = signal(false);
  readonly suggestions = signal<PromotionLookup[]>([]);

  readonly form = this.fb.nonNullable.group({
    promotion: this.fb.control<PromotionLookup | string | null>(null, promotionSelected),
    topic: ['', [Validators.required, notBlank, Validators.maxLength(100)]],
    description: ['', [Validators.required, notBlank, Validators.maxLength(300)]],
  });

  get isEdit(): boolean {
    return this.draft().pkid > 0;
  }

  ngOnInit(): void {
    const d = this.draft();
    this.form.setValue({ promotion: d.promotion, topic: d.topic, description: d.description });
  }

  searchPromotions(event: AutoCompleteCompleteEvent): void {
    this.lookups.getPromotions(event.query.trim()).subscribe({
      next: (list) => this.suggestions.set(list),
      error: () => this.suggestions.set([]),
    });
  }

  /** Picking a PromoCode copies its Topic / Description; they stay editable. */
  onPromotionSelect(event: AutoCompleteSelectEvent): void {
    const p = event.value as PromotionLookup;
    this.form.patchValue({ topic: p.topic, description: p.description });
  }

  isInvalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }

  /** Error text for a required string field: max length wins over required/blank. */
  textError(name: 'topic' | 'description', label: string, max: number): string {
    return this.form.controls[name].hasError('maxlength') ? `最多 ${max} 字` : `請輸入${label}`;
  }

  cancel(): void {
    this.cancelled.emit();
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const d = this.draft();
    const v = this.form.getRawValue();
    const promotion = v.promotion as PromotionLookup;
    const request: FeaturedPromoItemRequest = {
      pkid: d.pkid,
      scheduleOn: d.scheduleOn,
      trainingCenterPkid: d.trainingCenterPkid,
      slot: d.slot,
      promotionPkid: promotion.pkid,
      topic: v.topic.trim(),
      description: v.description.trim(),
    };

    this.saving.set(true);
    const op$: Observable<FeaturedPromoItem | void> = this.isEdit
      ? this.service.update(request)
      : this.service.create(request);
    op$.subscribe({
      next: (result) => {
        this.saving.set(false);
        this.messages.add({ severity: 'success', summary: '已儲存', detail: promotion.promoCode });
        this.saved.emit(result);
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

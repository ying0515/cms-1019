import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { Observable } from 'rxjs';

import { PublishStatusRequest } from '@core/models/publish-status.model';
import { PublishStatusService } from '@core/services/publish-status.service';
import { httpErrorMessage } from '@core/utils/http-error.util';

@Component({
  selector: 'app-publish-status-form',
  imports: [ReactiveFormsModule, ButtonModule, CheckboxModule, InputNumberModule, InputTextModule],
  templateUrl: './publish-status-form.html',
  styleUrl: './publish-status-form.scss',
})
export class PublishStatusForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(PublishStatusService);
  private readonly messages = inject(MessageService);

  readonly isEdit: boolean;
  /** Route pkid in edit mode; pkid is not IDENTITY, so 0 is a valid value. */
  readonly pkid: number;
  readonly loading = signal(true);
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    // tinyint, user-supplied on create, immutable on edit
    pkid: this.fb.control<number | null>(null, [Validators.required, Validators.min(0), Validators.max(255)]),
    description: ['', [Validators.required, Validators.maxLength(50)]],
    isDraft: false,
    isPublished: false,
    isDiscontinued: false,
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

    this.form.controls.pkid.disable();
    this.service.getById(this.pkid).subscribe({
      next: (s) => {
        this.form.patchValue({
          pkid: s.pkid,
          description: s.description,
          isDraft: s.isDraft,
          isPublished: s.isPublished,
          isDiscontinued: s.isDiscontinued,
        });
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
    if (this.isEdit) void this.router.navigate(['/publish-statuses', this.pkid]);
    else void this.router.navigate(['/publish-statuses']);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const request: PublishStatusRequest = {
      pkid: this.isEdit ? this.pkid : v.pkid!,
      description: v.description.trim(),
      isDraft: v.isDraft,
      isPublished: v.isPublished,
      isDiscontinued: v.isDiscontinued,
    };

    this.saving.set(true);
    const op$: Observable<unknown> = this.isEdit ? this.service.update(request) : this.service.create(request);
    op$.subscribe({
      next: () => {
        this.saving.set(false);
        this.messages.add({ severity: 'success', summary: '已儲存', detail: request.description });
        void this.router.navigate(['/publish-statuses', request.pkid]);
      },
      error: (err) => {
        this.saving.set(false);
        this.messages.add({ severity: 'error', summary: '儲存失敗', detail: httpErrorMessage(err) });
      },
    });
  }
}

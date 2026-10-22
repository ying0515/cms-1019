import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Observable } from 'rxjs';

import { CourseGroup, CourseGroupRequest } from '@core/models/course-group.model';
import { CourseGroupService } from '@core/services/course-group.service';
import { httpErrorMessage } from '@core/utils/http-error.util';

@Component({
  selector: 'app-course-group-form',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule],
  templateUrl: './course-group-form.html',
  styleUrl: './course-group-form.scss',
})
export class CourseGroupForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(CourseGroupService);
  private readonly messages = inject(MessageService);

  readonly isEdit: boolean;
  /** Route pkid in edit mode (IDENTITY, so 0 in add mode). */
  readonly pkid: number;
  readonly loading = signal(true);
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    // pattern rejects whitespace-only values, which Validators.required accepts
    description: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)]],
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
      next: (g) => {
        this.form.patchValue({ description: g.description });
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
    if (this.isEdit) void this.router.navigate(['/course-groups', this.pkid]);
    else void this.router.navigate(['/course-groups']);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const request: CourseGroupRequest = {
      pkid: this.pkid,
      description: this.form.getRawValue().description.trim(),
    };

    this.saving.set(true);
    const op$: Observable<CourseGroup | void> = this.isEdit
      ? this.service.update(request)
      : this.service.create(request);
    op$.subscribe({
      next: (created) => {
        this.saving.set(false);
        this.messages.add({ severity: 'success', summary: '已儲存', detail: request.description });
        void this.router.navigate(['/course-groups', created ? created.pkid : this.pkid]);
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

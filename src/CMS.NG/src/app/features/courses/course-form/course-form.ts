import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { Observable, forkJoin, of } from 'rxjs';

import { Course, CourseRequest } from '@core/models/course.model';
import {
  CertificationLookup,
  CourseGroupLookup,
  JobCategoryLookup,
  LookupOption,
  PartnerLookup,
  PublishStatusLookup,
} from '@core/models/lookup.model';
import { CourseService } from '@core/services/course.service';
import { LookupService } from '@core/services/lookup.service';
import { addYears, parseIsoDate, toIsoDate } from '@core/utils/date.util';
import { httpErrorMessage } from '@core/utils/http-error.util';

/** Rejects whitespace-only values (Validators.required accepts them). */
const notBlank = Validators.pattern(/\S/);

/** Years added to ScheduleOn to default ScheduleOff. */
const DEFAULT_PUBLISH_YEARS = 10;

/** Group validator: ScheduleOff must not be before ScheduleOn. */
function scheduleRange(group: AbstractControl): ValidationErrors | null {
  const on = group.get('scheduleOn')?.value as Date | null;
  const off = group.get('scheduleOff')?.value as Date | null;
  return on && off && toIsoDate(off) < toIsoDate(on) ? { scheduleRange: true } : null;
}

@Component({
  selector: 'app-course-form',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    CheckboxModule,
    DatePickerModule,
    InputNumberModule,
    InputTextModule,
    MultiSelectModule,
    SelectModule,
    TextareaModule,
  ],
  templateUrl: './course-form.html',
  styleUrl: './course-form.scss',
})
export class CourseForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(CourseService);
  private readonly lookups = inject(LookupService);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly isEdit: boolean;
  /** Route pkid in edit mode (IDENTITY, so 0 in add mode). */
  readonly pkid: number;
  readonly loading = signal(true);
  readonly saving = signal(false);

  partners: PartnerLookup[] = [];
  courseGroups: CourseGroupLookup[] = [];
  publishStatuses: PublishStatusLookup[] = [];
  certifications: CertificationLookup[] = [];
  jobCategories: JobCategoryLookup[] = [];

  readonly form = this.fb.nonNullable.group(
    {
      title: ['', [Validators.required, notBlank, Validators.maxLength(200)]],
      officialTitle: ['', Validators.maxLength(300)],
      courseId: ['', [Validators.required, notBlank, Validators.maxLength(50)]],
      prodCourseId: ['', [Validators.required, notBlank, Validators.maxLength(50)]],
      friendlyUrl: ['', [Validators.required, notBlank, Validators.maxLength(100)]],
      displayOrder: this.fb.control<number | null>(0, Validators.required),
      partnerPkid: this.fb.control<number | null>(null, Validators.required),
      courseGroupPkid: this.fb.control<number | null>(null),
      publishStatusPkid: this.fb.control<number | null>(null, Validators.required),
      scheduleOn: this.fb.control<Date | null>(null, Validators.required),
      scheduleOff: this.fb.control<Date | null>(null, Validators.required),
      hour: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
      listPrice: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
      learningCredit: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
      canRepeat: false,
      material: ['', Validators.maxLength(500)],
      objective: ['', Validators.maxLength(4000)],
      target: ['', Validators.maxLength(500)],
      prerequisites: ['', Validators.maxLength(4000)],
      outline: [''],
      towardCertOrExam: [''],
      note: ['', Validators.maxLength(4000)],
      otherInfo: ['', Validators.maxLength(4000)],
      certificationPkids: this.fb.nonNullable.control<number[]>([]),
      jobCategoryPkids: this.fb.nonNullable.control<number[]>([]),
    },
    { validators: scheduleRange },
  );

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    this.isEdit = id !== null;
    this.pkid = id !== null ? Number(id) : 0;
  }

  get partnerOptions(): LookupOption<number>[] {
    return this.partners.map((p) => ({ pkid: p.pkid, label: p.name }));
  }

  get courseGroupOptions(): LookupOption<number>[] {
    return this.courseGroups.map((g) => ({ pkid: g.pkid, label: g.description }));
  }

  get publishStatusOptions(): LookupOption<number>[] {
    return this.publishStatuses.map((s) => ({ pkid: s.pkid, label: s.description }));
  }

  get certificationOptions(): LookupOption<number>[] {
    return this.certifications.map((c) => ({
      pkid: c.pkid,
      label: `${c.partnerName} - ${c.title ?? ''}`,
    }));
  }

  get jobCategoryOptions(): LookupOption<number>[] {
    return this.jobCategories.map((j) => ({ pkid: j.pkid, label: j.description }));
  }

  ngOnInit(): void {
    // ScheduleOff follows ScheduleOn (+10 years); the user can still override it afterwards
    this.form.controls.scheduleOn.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((on) => {
        if (on instanceof Date) {
          this.form.controls.scheduleOff.setValue(addYears(on, DEFAULT_PUBLISH_YEARS), {
            emitEvent: false,
          });
        }
      });

    if (!this.isEdit) {
      const today = new Date();
      this.form.controls.scheduleOn.setValue(
        new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      );
    }

    const course$: Observable<Course | null> = this.isEdit
      ? this.service.getById(this.pkid)
      : of(null);

    forkJoin({
      partners: this.lookups.getPartners(),
      courseGroups: this.lookups.getCourseGroups(),
      publishStatuses: this.lookups.getPublishStatuses(),
      certifications: this.lookups.getCertifications(),
      jobCategories: this.lookups.getJobCategories(),
      course: course$,
    }).subscribe({
      next: (r) => {
        this.partners = r.partners;
        this.courseGroups = r.courseGroups;
        this.publishStatuses = r.publishStatuses;
        this.certifications = r.certifications;
        this.jobCategories = r.jobCategories;
        if (r.course) this.patch(r.course);
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

  /** scheduleOn is patched before scheduleOff so the loaded ScheduleOff wins over the default. */
  private patch(c: Course): void {
    this.form.patchValue({
      title: c.title,
      officialTitle: c.officialTitle ?? '',
      courseId: c.courseId,
      prodCourseId: c.prodCourseId,
      friendlyUrl: c.friendlyUrl,
      displayOrder: c.displayOrder,
      partnerPkid: c.partnerPkid,
      courseGroupPkid: c.courseGroupPkid,
      publishStatusPkid: c.publishStatusPkid,
      scheduleOn: parseIsoDate(c.scheduleOn),
      scheduleOff: parseIsoDate(c.scheduleOff),
      hour: c.hour,
      listPrice: c.listPrice,
      learningCredit: c.learningCredit,
      canRepeat: c.canRepeat,
      material: c.material ?? '',
      objective: c.objective ?? '',
      target: c.target ?? '',
      prerequisites: c.prerequisites ?? '',
      outline: c.outline ?? '',
      towardCertOrExam: c.towardCertOrExam ?? '',
      note: c.note ?? '',
      otherInfo: c.otherInfo ?? '',
      certificationPkids: c.certifications.map((x) => x.pkid),
      jobCategoryPkids: c.jobCategories.map((x) => x.pkid),
    });
  }

  isInvalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }

  get scheduleRangeInvalid(): boolean {
    const off = this.form.controls.scheduleOff;
    return this.form.hasError('scheduleRange') && (off.dirty || off.touched);
  }

  /** Error text for a required string field: max length wins over required/blank. */
  textError(name: keyof typeof this.form.controls, label: string, max: number): string {
    return this.form.controls[name].hasError('maxlength') ? `最多 ${max} 字` : `請輸入${label}`;
  }

  cancel(): void {
    if (this.isEdit) this.router.navigate(['/courses', this.pkid]);
    else this.router.navigate(['/courses']);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const request: CourseRequest = {
      pkid: this.pkid,
      title: v.title.trim(),
      officialTitle: v.officialTitle.trim() || null,
      courseId: v.courseId.trim(),
      prodCourseId: v.prodCourseId.trim(),
      friendlyUrl: v.friendlyUrl.trim(),
      displayOrder: v.displayOrder!,
      partnerPkid: v.partnerPkid!,
      courseGroupPkid: v.courseGroupPkid ?? null,
      publishStatusPkid: v.publishStatusPkid!,
      scheduleOn: toIsoDate(v.scheduleOn!),
      scheduleOff: toIsoDate(v.scheduleOff!),
      hour: v.hour!,
      listPrice: v.listPrice!,
      learningCredit: v.learningCredit!,
      canRepeat: v.canRepeat,
      material: v.material.trim() || null,
      objective: v.objective.trim() || null,
      target: v.target.trim() || null,
      prerequisites: v.prerequisites.trim() || null,
      outline: v.outline.trim() || null,
      towardCertOrExam: v.towardCertOrExam.trim() || null,
      note: v.note.trim() || null,
      otherInfo: v.otherInfo.trim() || null,
      certificationPkids: v.certificationPkids,
      jobCategoryPkids: v.jobCategoryPkids,
    };

    this.saving.set(true);
    const op$: Observable<Course | void> = this.isEdit
      ? this.service.update(request)
      : this.service.create(request);
    op$.subscribe({
      next: (created) => {
        this.saving.set(false);
        this.messages.add({ severity: 'success', summary: '已儲存', detail: request.title });
        this.router.navigate(['/courses', created ? created.pkid : this.pkid]);
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

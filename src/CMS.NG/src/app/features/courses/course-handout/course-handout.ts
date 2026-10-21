import { ChangeDetectorRef, Component, computed, inject, input, signal } from '@angular/core';

import { Course } from '@core/models/course.model';
import { CertificationLookup } from '@core/models/lookup.model';
import { toIsoDate } from '@core/utils/date.util';
import { CONTENT_FIELDS, HANDOUT_CONTENT_KEYS } from '../course-content-fields';
import { CourseQrCode } from '../course-qr-code/course-qr-code';

/** A4 handout for students/instructors; rendered only when printing the course detail page. */
@Component({
  selector: 'app-course-handout',
  imports: [CourseQrCode],
  templateUrl: './course-handout.html',
  styleUrl: './course-handout.scss',
  host: { '(window:beforeprint)': 'refreshToday()' },
})
export class CourseHandout {
  private readonly cdr = inject(ChangeDetectorRef);

  /** A course from `CourseService.getById`: list results carry empty certifications/jobCategories. */
  readonly course = input.required<Course>();

  /** Local date that decides whether the QR prints; refreshed right before printing. */
  private readonly today = signal(toIsoDate(new Date()));

  /** 簡介代碼 and hours; each part is left out when blank or not positive. */
  readonly meta = computed(() => {
    const c = this.course();
    const id = c.courseId.trim();
    return [id ? `簡介代碼 ${id}` : '', c.hour > 0 ? `時數 ${c.hour} 小時` : '']
      .filter((part) => part !== '')
      .join('｜');
  });

  /**
   * The public course page is live: published status and today within the schedule.
   * Its URL needs the course id, so a blank one prints the fallback line too.
   */
  readonly isOnline = computed(() => {
    const c = this.course();
    const today = this.today();
    return (
      !!c.publishStatus?.isPublished &&
      c.scheduleOn <= today &&
      today <= c.scheduleOff &&
      c.courseId.trim() !== ''
    );
  });

  /** Whitelisted content fields that have text, in HANDOUT_CONTENT_KEYS order. */
  readonly sections = computed(() => {
    const c = this.course();
    return HANDOUT_CONTENT_KEYS.map((key) => ({
      key,
      label: CONTENT_FIELDS.find((f) => f.key === key)!.label,
      text: (c[key] ?? '').trim(),
    })).filter((s) => s.text !== '');
  });

  /**
   * Runs on beforeprint (button and Ctrl+P), so a tab left open past midnight prints with
   * today's date. Rendered synchronously: the browser lays out the page right after this event.
   */
  refreshToday(): void {
    this.today.set(toIsoDate(new Date()));
    this.cdr.detectChanges();
  }

  certificationText(c: CertificationLookup): string {
    const title = c.title?.trim();
    return title ? `${c.partnerName} - ${title}` : c.partnerName;
  }
}

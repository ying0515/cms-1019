import { Component, computed, input } from '@angular/core';

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
})
export class CourseHandout {
  /** A course from `CourseService.getById`: list results carry empty certifications/jobCategories. */
  readonly course = input.required<Course>();

  /** 簡介代碼 line; hours are left out when not positive. */
  readonly meta = computed(() => {
    const c = this.course();
    const id = `簡介代碼 ${c.courseId.trim()}`;
    return c.hour > 0 ? `${id}｜時數 ${c.hour} 小時` : id;
  });

  /** The public course page is live: published status and today within the schedule. */
  readonly isOnline = computed(() => {
    const c = this.course();
    const today = toIsoDate(new Date());
    return !!c.publishStatus?.isPublished && c.scheduleOn <= today && today <= c.scheduleOff;
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

  certificationText(c: CertificationLookup): string {
    const title = c.title?.trim();
    return title ? `${c.partnerName} - ${title}` : c.partnerName;
  }
}

import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { CourseService } from '@core/services/course.service';
import { LookupService } from '@core/services/lookup.service';
import { expectPinnedToolbar } from '@core/testing/form-toolbar';
import { toIsoDate } from '@core/utils/date.util';
import {
  AZ104,
  CCNA,
  CERTIFICATIONS,
  COURSE_GROUPS,
  JOB_CATEGORIES,
  PARTNERS,
  PUBLISH_STATUSES,
} from '../testing/course.fixtures';
import { CourseForm } from './course-form';

describe('CourseForm', () => {
  let service: jasmine.SpyObj<CourseService>;
  let lookups: jasmine.SpyObj<LookupService>;
  let router: Router;

  async function setup(id: string | null) {
    service = jasmine.createSpyObj<CourseService>('CourseService', ['getById', 'create', 'update']);
    service.getById.and.returnValue(of(AZ104));
    service.create.and.returnValue(of({ ...CCNA, pkid: 4 }));
    service.update.and.returnValue(of(void 0));
    lookups = jasmine.createSpyObj<LookupService>('LookupService', [
      'getPartners',
      'getCourseGroups',
      'getPublishStatuses',
      'getCertifications',
      'getJobCategories',
    ]);
    lookups.getPartners.and.returnValue(of(PARTNERS));
    lookups.getCourseGroups.and.returnValue(of(COURSE_GROUPS));
    lookups.getPublishStatuses.and.returnValue(of(PUBLISH_STATUSES));
    lookups.getCertifications.and.returnValue(of(CERTIFICATIONS));
    lookups.getJobCategories.and.returnValue(of(JOB_CATEGORIES));

    await TestBed.configureTestingModule({
      imports: [CourseForm],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        { provide: CourseService, useValue: service },
        { provide: LookupService, useValue: lookups },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(id !== null ? { id } : {}) } },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  }

  function create() {
    const fixture = TestBed.createComponent(CourseForm);
    fixture.detectChanges();
    return fixture;
  }

  /** Fills every required field with valid values. */
  function fillValid(form: CourseForm['form']) {
    form.patchValue({
      title: ' Oracle 資料庫管理 ',
      courseId: 'ORA-DBA',
      prodCourseId: '1Z0-082',
      friendlyUrl: 'oracle-dba',
      displayOrder: 5,
      partnerPkid: 2,
      publishStatusPkid: 1,
      scheduleOn: new Date(2026, 9, 1),
    });
  }

  describe('add mode', () => {
    beforeEach(() => setup(null));

    it('loads all lookups in parallel without fetching a course', () => {
      const c = create().componentInstance;

      expect(service.getById).not.toHaveBeenCalled();
      expect(lookups.getCertifications).toHaveBeenCalled();
      expect(lookups.getJobCategories).toHaveBeenCalled();
      expect(c.loading()).toBeFalse();
      expect(c.certificationOptions).toEqual([
        { pkid: 1, label: 'Microsoft - Azure Administrator Associate' },
        { pkid: 3, label: 'Cisco - CCNA' },
      ]);
    });

    it('defaults ScheduleOn to today and ScheduleOff to ten years later', () => {
      const c = create().componentInstance;
      const today = new Date();

      expect(toIsoDate(c.form.controls.scheduleOn.value!)).toBe(toIsoDate(today));
      expect(c.form.controls.scheduleOff.value!.getFullYear()).toBe(today.getFullYear() + 10);
      expect(c.form.controls.displayOrder.value).toBe(0);
      expect(c.form.controls.canRepeat.value).toBeFalse();
    });

    it('re-defaults ScheduleOff when ScheduleOn changes', () => {
      const c = create().componentInstance;

      c.form.controls.scheduleOn.setValue(new Date(2027, 1, 15));

      expect(toIsoDate(c.form.controls.scheduleOff.value!)).toBe('2037-02-15');
    });

    it('is invalid until required fields are filled', () => {
      const c = create().componentInstance;
      const required = [
        'title',
        'courseId',
        'prodCourseId',
        'friendlyUrl',
        'partnerPkid',
        'publishStatusPkid',
      ] as const;

      expect(c.form.invalid).toBeTrue();
      for (const name of required) {
        expect(c.form.controls[name].hasError('required')).withContext(name).toBeTrue();
      }
      expect(c.form.controls.courseGroupPkid.valid).toBeTrue(); // optional FK
    });

    it('rejects whitespace-only and too-long strings, and negative numbers', () => {
      const c = create().componentInstance;
      fillValid(c.form);

      c.form.controls.title.setValue('   ');
      expect(c.form.controls.title.invalid).toBeTrue();
      c.form.controls.courseId.setValue('x'.repeat(51));
      expect(c.textError('courseId', '簡介代碼', 50)).toBe('最多 50 字');
      c.form.controls.objective.setValue('x'.repeat(4001));
      expect(c.form.controls.objective.invalid).toBeTrue();
      c.form.controls.hour.setValue(-1);
      expect(c.form.controls.hour.invalid).toBeTrue();
    });

    it('rejects ScheduleOff before ScheduleOn but allows the same day', () => {
      const c = create().componentInstance;
      fillValid(c.form);

      c.form.controls.scheduleOff.setValue(new Date(2026, 8, 30));
      expect(c.form.hasError('scheduleRange')).toBeTrue();

      c.form.controls.scheduleOff.setValue(new Date(2026, 9, 1));
      expect(c.form.hasError('scheduleRange')).toBeFalse();
      expect(c.form.valid).toBeTrue();
    });

    it('does not submit an invalid form and marks fields touched', () => {
      const fixture = create();
      const c = fixture.componentInstance;

      c.save();
      fixture.detectChanges();

      expect(service.create).not.toHaveBeenCalled();
      expect(c.isInvalid('title')).toBeTrue();
      expect(fixture.nativeElement.textContent).toContain('請輸入課程名稱');
      expect(fixture.nativeElement.textContent).toContain('請選擇原廠');
    });

    it('creates with trimmed values, ISO dates, nulls for blanks and n-n ids, then opens the detail', () => {
      const c = create().componentInstance;
      fillValid(c.form);
      c.form.patchValue({
        officialTitle: '   ',
        learningCredit: 3.5,
        canRepeat: true,
        certificationPkids: [3],
        jobCategoryPkids: [1, 3],
      });

      c.save();

      expect(service.create).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({
          pkid: 0,
          title: 'Oracle 資料庫管理',
          officialTitle: null,
          courseGroupPkid: null,
          scheduleOn: '2026-10-01',
          scheduleOff: '2036-10-01',
          learningCredit: 3.5,
          canRepeat: true,
          material: null,
          outline: null,
          certificationPkids: [3],
          jobCategoryPkids: [1, 3],
        }),
      );
      expect(router.navigate).toHaveBeenCalledWith(['/courses', 4]);
    });

    it('shows an error toast and stays on the page when create fails', () => {
      service.create.and.returnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: { message: '原廠、課程群組、上架狀態、認證或職務類別不存在' },
            }),
        ),
      );
      const c = create().componentInstance;
      const add = spyOn(TestBed.inject(MessageService), 'add');
      fillValid(c.form);

      c.save();

      expect(add).toHaveBeenCalledWith(
        jasmine.objectContaining({
          severity: 'error',
          detail: '原廠、課程群組、上架狀態、認證或職務類別不存在',
        }),
      );
      expect(router.navigate).not.toHaveBeenCalled();
      expect(c.saving()).toBeFalse();
    });

    it('pins the Save/Cancel toolbar to the top of the form', () => {
      expectPinnedToolbar(create().nativeElement);
    });

    it('cancel() returns to the list', () => {
      create().componentInstance.cancel();

      expect(router.navigate).toHaveBeenCalledWith(['/courses']);
    });
  });

  describe('edit mode', () => {
    beforeEach(() => setup('1'));

    it('loads the course and patches values, keeping the loaded ScheduleOff', () => {
      const c = create().componentInstance;

      expect(service.getById).toHaveBeenCalledOnceWith(1);
      const v = c.form.getRawValue();
      expect(v.title).toBe('Microsoft Azure 管理員');
      expect(v.partnerPkid).toBe(1);
      expect(v.courseGroupPkid).toBe(1);
      expect(v.material).toBe('');
      expect(toIsoDate(v.scheduleOn!)).toBe('2026-01-01');
      expect(toIsoDate(v.scheduleOff!)).toBe('2036-01-01');
      expect(v.certificationPkids).toEqual([1]);
      expect(v.jobCategoryPkids).toEqual([1]);
    });

    it('keeps a loaded ScheduleOff that is not ten years after ScheduleOn', () => {
      service.getById.and.returnValue(of(CCNA));
      const c = create().componentInstance;

      expect(toIsoDate(c.form.controls.scheduleOff.value!)).toBe('2027-03-01');
    });

    it('shows the read-only pkid', () => {
      const el: HTMLElement = create().nativeElement;

      expect((el.querySelector('#pkid') as HTMLInputElement).value).toBe('1');
    });

    it('updates with the route pkid and returns to the detail page', () => {
      const c = create().componentInstance;
      c.form.patchValue({ title: '新名稱', courseGroupPkid: null });

      c.save();

      expect(service.update).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ pkid: 1, title: '新名稱', courseGroupPkid: null }),
      );
      expect(router.navigate).toHaveBeenCalledWith(['/courses', 1]);
    });

    it('shows an error toast when loading fails', async () => {
      service.getById.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      const add = spyOn(TestBed.inject(MessageService), 'add');
      const c = create().componentInstance;

      expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ summary: '載入失敗' }));
      expect(c.loading()).toBeFalse();
    });

    it('pins the Save/Cancel toolbar to the top of the form', () => {
      expectPinnedToolbar(create().nativeElement);
    });

    it('cancel() returns to the detail page', () => {
      create().componentInstance.cancel();

      expect(router.navigate).toHaveBeenCalledWith(['/courses', 1]);
    });
  });
});

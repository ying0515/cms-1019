import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { CourseGroupService } from '@core/services/course-group.service';
import { expectPinnedToolbar } from '@core/testing/form-toolbar';
import { SECURITY_GROUP } from '../testing/course-group.fixtures';
import { CourseGroupForm } from './course-group-form';

describe('CourseGroupForm', () => {
  let service: jasmine.SpyObj<CourseGroupService>;
  let router: Router;

  async function setup(id: string | null) {
    service = jasmine.createSpyObj<CourseGroupService>('CourseGroupService', [
      'getById',
      'create',
      'update',
    ]);
    service.getById.and.returnValue(of(SECURITY_GROUP));
    service.create.and.returnValue(of({ pkid: 4, description: '資料庫' }));
    service.update.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [CourseGroupForm],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        { provide: CourseGroupService, useValue: service },
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
    const fixture = TestBed.createComponent(CourseGroupForm);
    fixture.detectChanges();
    return fixture;
  }

  describe('add mode', () => {
    beforeEach(() => setup(null));

    it('starts empty with no pkid field', () => {
      const fixture = create();
      const c = fixture.componentInstance;

      expect(c.isEdit).toBeFalse();
      expect(service.getById).not.toHaveBeenCalled();
      expect(c.form.getRawValue()).toEqual({ description: '' });
      expect(fixture.nativeElement.querySelector('#pkid')).toBeNull();
      expect(fixture.nativeElement.querySelector('h1').textContent).toContain('新增課程群組');
    });

    it('does not submit when description is missing and shows the error', () => {
      const fixture = create();
      const c = fixture.componentInstance;

      c.save();
      fixture.detectChanges();

      expect(c.form.controls.description.hasError('required')).toBeTrue();
      expect(c.form.controls.description.touched).toBeTrue();
      expect(fixture.nativeElement.querySelector('.error')?.textContent).toContain(
        '請輸入群組名稱',
      );
      expect(service.create).not.toHaveBeenCalled();
    });

    it('rejects whitespace-only and over-100-character descriptions', () => {
      const c = create().componentInstance;

      c.form.controls.description.setValue('   ');
      expect(c.form.controls.description.invalid).toBeTrue();

      c.form.controls.description.setValue('x'.repeat(101));
      expect(c.form.controls.description.hasError('maxlength')).toBeTrue();

      c.save();
      expect(service.create).not.toHaveBeenCalled();
    });

    it('creates with the trimmed description and navigates to the new detail page', () => {
      const c = create().componentInstance;
      c.form.setValue({ description: ' 資料庫 ' });

      c.save();

      expect(service.create).toHaveBeenCalledOnceWith({ pkid: 0, description: '資料庫' });
      expect(router.navigate).toHaveBeenCalledWith(['/course-groups', 4]);
    });

    it('shows an error toast and stays on the page when save fails', () => {
      service.create.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 400, error: { message: '資料錯誤' } })),
      );
      const add = spyOn(TestBed.inject(MessageService), 'add');
      const c = create().componentInstance;
      c.form.setValue({ description: '資料庫' });

      c.save();

      expect(add).toHaveBeenCalledWith(
        jasmine.objectContaining({ severity: 'error', detail: '資料錯誤' }),
      );
      expect(router.navigate).not.toHaveBeenCalled();
      expect(c.saving()).toBeFalse();
    });

    it('pins the Save/Cancel toolbar to the top of the form', () => {
      expectPinnedToolbar(create().nativeElement);
    });

    it('cancel() returns to the list', () => {
      create().componentInstance.cancel();
      expect(router.navigate).toHaveBeenCalledWith(['/course-groups']);
    });
  });

  describe('edit mode', () => {
    beforeEach(() => setup('2'));

    it('loads the group and patches the form, showing pkid read-only', () => {
      const fixture = create();
      const c = fixture.componentInstance;

      expect(c.isEdit).toBeTrue();
      expect(service.getById).toHaveBeenCalledOnceWith(2);
      expect(c.form.getRawValue()).toEqual({ description: '資訊安全' });
      const pkid: HTMLInputElement = fixture.nativeElement.querySelector('#pkid');
      expect(pkid.value).toBe('2');
      expect(pkid.disabled).toBeTrue();
      expect(fixture.nativeElement.querySelector('h1').textContent).toContain('編輯課程群組');
      expect(c.loading()).toBeFalse();
    });

    it('updates with pkid in the body and navigates to the detail page', () => {
      const c = create().componentInstance;
      c.form.patchValue({ description: '資安' });

      c.save();

      expect(service.update).toHaveBeenCalledOnceWith({ pkid: 2, description: '資安' });
      expect(service.create).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/course-groups', 2]);
    });

    it('does not submit when description is cleared', () => {
      const c = create().componentInstance;
      c.form.controls.description.setValue('');

      c.save();

      expect(service.update).not.toHaveBeenCalled();
    });

    it('pins the Save/Cancel toolbar to the top of the form', () => {
      expectPinnedToolbar(create().nativeElement);
    });

    it('cancel() returns to the detail page', () => {
      create().componentInstance.cancel();
      expect(router.navigate).toHaveBeenCalledWith(['/course-groups', 2]);
    });
  });
});

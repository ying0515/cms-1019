import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { PublishStatusService } from '@core/services/publish-status.service';
import { expectPinnedToolbar } from '@core/testing/form-toolbar';
import { DRAFT_STATUS } from '../testing/publish-status.fixtures';
import { PublishStatusForm } from './publish-status-form';

describe('PublishStatusForm', () => {
  let service: jasmine.SpyObj<PublishStatusService>;
  let router: Router;

  async function setup(id: string | null) {
    service = jasmine.createSpyObj<PublishStatusService>('PublishStatusService', ['getById', 'create', 'update']);
    service.getById.and.returnValue(of(DRAFT_STATUS));
    service.create.and.returnValue(of({ ...DRAFT_STATUS, pkid: 10, description: '審核中' }));
    service.update.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [PublishStatusForm],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        { provide: PublishStatusService, useValue: service },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id !== null ? { id } : {}) } } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  }

  function create() {
    const fixture = TestBed.createComponent(PublishStatusForm);
    fixture.detectChanges();
    return fixture;
  }

  describe('add mode', () => {
    beforeEach(() => setup(null));

    it('starts empty with pkid enabled and flags unchecked', () => {
      const fixture = create();
      const c = fixture.componentInstance;

      expect(c.isEdit).toBeFalse();
      expect(service.getById).not.toHaveBeenCalled();
      expect(c.form.controls.pkid.enabled).toBeTrue();
      expect(c.form.getRawValue()).toEqual({
        pkid: null,
        description: '',
        isDraft: false,
        isPublished: false,
        isDiscontinued: false,
      });
      expect(fixture.nativeElement.querySelector('h1').textContent).toContain('新增發布狀態');
    });

    it('does not submit when required fields are missing', () => {
      const c = create().componentInstance;

      c.save();

      expect(c.form.invalid).toBeTrue();
      expect(c.form.controls.pkid.hasError('required')).toBeTrue();
      expect(c.form.controls.description.hasError('required')).toBeTrue();
      expect(c.form.controls.description.touched).toBeTrue();
      expect(service.create).not.toHaveBeenCalled();
    });

    it('rejects pkid outside 0–255 and descriptions over 50 characters', () => {
      const c = create().componentInstance;
      c.form.controls.pkid.setValue(256);
      c.form.controls.description.setValue('x'.repeat(51));

      expect(c.form.controls.pkid.hasError('max')).toBeTrue();
      expect(c.form.controls.description.hasError('maxlength')).toBeTrue();

      c.form.controls.pkid.setValue(-1);
      expect(c.form.controls.pkid.hasError('min')).toBeTrue();
    });

    it('creates with the entered pkid and trimmed description, then navigates to detail', () => {
      const c = create().componentInstance;
      c.form.setValue({ pkid: 10, description: ' 審核中 ', isDraft: true, isPublished: false, isDiscontinued: false });

      c.save();

      expect(service.create).toHaveBeenCalledOnceWith({
        pkid: 10,
        description: '審核中',
        isDraft: true,
        isPublished: false,
        isDiscontinued: false,
      });
      expect(router.navigate).toHaveBeenCalledWith(['/publish-statuses', 10]);
    });

    it('allows pkid 0', () => {
      const c = create().componentInstance;
      c.form.patchValue({ pkid: 0, description: '未設定' });

      c.save();

      expect(service.create).toHaveBeenCalledWith(jasmine.objectContaining({ pkid: 0 }));
      expect(router.navigate).toHaveBeenCalledWith(['/publish-statuses', 0]);
    });

    it('shows an error toast and stays on the page on 409 Conflict', () => {
      service.create.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 409, error: { message: '主代碼 1 已存在' } })),
      );
      const add = spyOn(TestBed.inject(MessageService), 'add');
      const c = create().componentInstance;
      c.form.patchValue({ pkid: 1, description: 'Dup' });

      c.save();

      expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: '主代碼 1 已存在' }));
      expect(router.navigate).not.toHaveBeenCalled();
      expect(c.saving()).toBeFalse();
    });

    it('pins the Save/Cancel toolbar to the top of the form', () => {
      expectPinnedToolbar(create().nativeElement);
    });

    it('cancel() returns to the list', () => {
      create().componentInstance.cancel();
      expect(router.navigate).toHaveBeenCalledWith(['/publish-statuses']);
    });
  });

  describe('edit mode', () => {
    beforeEach(() => setup('1'));

    it('loads the status and patches the form, with pkid disabled', () => {
      const fixture = create();
      const c = fixture.componentInstance;

      expect(c.isEdit).toBeTrue();
      expect(service.getById).toHaveBeenCalledOnceWith(1);
      expect(c.form.controls.pkid.disabled).toBeTrue();
      expect(c.form.getRawValue()).toEqual({
        pkid: 1,
        description: '草稿',
        isDraft: true,
        isPublished: false,
        isDiscontinued: false,
      });
      expect(fixture.nativeElement.querySelector('h1').textContent).toContain('編輯發布狀態');
      expect(c.loading()).toBeFalse();
    });

    it('updates with pkid in the body and navigates to the detail page', () => {
      const c = create().componentInstance;
      c.form.patchValue({ description: '草稿中', isDiscontinued: true });

      c.save();

      expect(service.update).toHaveBeenCalledOnceWith({
        pkid: 1,
        description: '草稿中',
        isDraft: true,
        isPublished: false,
        isDiscontinued: true,
      });
      expect(service.create).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/publish-statuses', 1]);
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
      expect(router.navigate).toHaveBeenCalledWith(['/publish-statuses', 1]);
    });
  });
});

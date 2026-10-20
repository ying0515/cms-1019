import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { provideRowAuditStub, rowAuditStub } from '@core/testing/row-audit';
import { PartnerService } from '@core/services/partner.service';
import { expectPinnedToolbar } from '@core/testing/form-toolbar';
import { CISCO, MICROSOFT } from '../testing/partner.fixtures';
import { PartnerForm } from './partner-form';

describe('PartnerForm', () => {
  let service: jasmine.SpyObj<PartnerService>;
  let router: Router;

  const valid = {
    name: ' Oracle ',
    appKey: 'ORA',
    nameOnPartnerMenu: '甲骨文 Oracle',
    nameOnCourseDetailPage: '甲骨文',
    displayOrder: 5,
    imageFilename: '  ',
  };

  async function setup(id: string | null) {
    service = jasmine.createSpyObj<PartnerService>('PartnerService', [
      'getById',
      'create',
      'update',
    ]);
    service.getById.and.returnValue(of(CISCO));
    service.create.and.returnValue(of({ ...MICROSOFT, pkid: 4, name: 'Oracle' }));
    service.update.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [PartnerForm],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        provideRowAuditStub(),
        MessageService,
        { provide: PartnerService, useValue: service },
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
    const fixture = TestBed.createComponent(PartnerForm);
    fixture.detectChanges();
    return fixture;
  }

  describe('add mode', () => {
    beforeEach(() => setup(null));

    it('starts empty with displayOrder 0 and no pkid field', () => {
      const fixture = create();
      const c = fixture.componentInstance;

      expect(c.isEdit).toBeFalse();
      expect(service.getById).not.toHaveBeenCalled();
      expect(c.form.getRawValue()).toEqual({
        name: '',
        appKey: '',
        nameOnPartnerMenu: '',
        nameOnCourseDetailPage: '',
        displayOrder: 0,
        imageFilename: '',
      });
      expect(fixture.nativeElement.querySelector('#pkid')).toBeNull();
      expect(fixture.nativeElement.querySelector('h1').textContent).toContain('新增合作廠商');
    });

    it('does not submit when required fields are missing', () => {
      const c = create().componentInstance;

      c.save();

      expect(c.form.invalid).toBeTrue();
      for (const name of [
        'name',
        'appKey',
        'nameOnPartnerMenu',
        'nameOnCourseDetailPage',
      ] as const) {
        expect(c.form.controls[name].hasError('required')).withContext(name).toBeTrue();
        expect(c.form.controls[name].touched).withContext(name).toBeTrue();
      }
      expect(c.form.controls.imageFilename.valid).toBeTrue();
      expect(service.create).not.toHaveBeenCalled();
    });

    it('rejects whitespace-only required fields and a cleared displayOrder', () => {
      const c = create().componentInstance;
      c.form.setValue({ ...valid, name: '   ', displayOrder: null });

      c.save();

      expect(c.form.controls.name.invalid).toBeTrue();
      expect(c.form.controls.displayOrder.hasError('required')).toBeTrue();
      expect(service.create).not.toHaveBeenCalled();
    });

    it('enforces column max lengths', () => {
      const c = create().componentInstance;
      c.form.setValue({
        name: 'x'.repeat(51),
        appKey: 'x'.repeat(11),
        nameOnPartnerMenu: 'x'.repeat(201),
        nameOnCourseDetailPage: 'x'.repeat(51),
        displayOrder: 1,
        imageFilename: 'x'.repeat(51),
      });

      for (const name of [
        'name',
        'appKey',
        'nameOnPartnerMenu',
        'nameOnCourseDetailPage',
        'imageFilename',
      ] as const) {
        expect(c.form.controls[name].hasError('maxlength')).withContext(name).toBeTrue();
      }
      expect(c.textError('appKey', '應用代碼', 10)).toBe('最多 10 字');
    });

    it('creates with trimmed values (blank image → null) and navigates to the new detail page', () => {
      const c = create().componentInstance;
      c.form.setValue(valid);

      c.save();

      expect(service.create).toHaveBeenCalledOnceWith({
        pkid: 0,
        name: 'Oracle',
        appKey: 'ORA',
        nameOnPartnerMenu: '甲骨文 Oracle',
        nameOnCourseDetailPage: '甲骨文',
        displayOrder: 5,
        imageFilename: null,
      });
      expect(router.navigate).toHaveBeenCalledWith(['/partners', 4]);
    });

    it('shows an error toast and stays on the page when save fails', () => {
      service.create.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 400, error: { message: '資料錯誤' } })),
      );
      const add = spyOn(TestBed.inject(MessageService), 'add');
      const c = create().componentInstance;
      c.form.setValue(valid);

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
      expect(router.navigate).toHaveBeenCalledWith(['/partners']);
    });
  });

  describe('edit mode', () => {
    beforeEach(() => setup('2'));

    it('loads the partner and patches the form (null image → empty string)', () => {
      const fixture = create();
      const c = fixture.componentInstance;

      expect(c.isEdit).toBeTrue();
      expect(service.getById).toHaveBeenCalledOnceWith(2);
      expect(c.form.getRawValue()).toEqual({
        name: 'Cisco',
        appKey: 'CISCO',
        nameOnPartnerMenu: '思科 Cisco',
        nameOnCourseDetailPage: '思科',
        displayOrder: 2,
        imageFilename: '',
      });
      expect(fixture.nativeElement.querySelector('#pkid').value).toBe('2');
      expect(fixture.nativeElement.querySelector('h1').textContent).toContain('編輯合作廠商');
      expect(c.loading()).toBeFalse();
    });

    it('updates with pkid in the body and navigates to the detail page', () => {
      const c = create().componentInstance;
      c.form.patchValue({ name: 'Cisco Systems', imageFilename: 'cisco.png' });

      c.save();

      expect(service.update).toHaveBeenCalledOnceWith({
        pkid: 2,
        name: 'Cisco Systems',
        appKey: 'CISCO',
        nameOnPartnerMenu: '思科 Cisco',
        nameOnCourseDetailPage: '思科',
        displayOrder: 2,
        imageFilename: 'cisco.png',
      });
      expect(service.create).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/partners', 2]);
    });

    it('does not submit when a required field is cleared', () => {
      const c = create().componentInstance;
      c.form.controls.appKey.setValue('');

      c.save();

      expect(service.update).not.toHaveBeenCalled();
    });

    it('pins the Save/Cancel toolbar to the top of the form', () => {
      expectPinnedToolbar(create().nativeElement);
    });

    it('cancel() returns to the detail page', () => {
      create().componentInstance.cancel();
      expect(router.navigate).toHaveBeenCalledWith(['/partners', 2]);
    });
  });

  describe('row-audit badge', () => {
    it('shows the badge for the edited record next to the title', async () => {
      await setup('2');
      const fixture = create();

      expect(fixture.nativeElement.querySelector('.form-toolbar .start app-row-audit-badge')).toBeTruthy();
      expect(rowAuditStub().getHistory).toHaveBeenCalledOnceWith('Partner', 2);
    });

    it('has no badge in add mode', async () => {
      await setup(null);
      const fixture = create();

      expect(fixture.nativeElement.querySelector('app-row-audit-badge')).toBeNull();
      expect(rowAuditStub().getHistory).not.toHaveBeenCalled();
    });
  });
});

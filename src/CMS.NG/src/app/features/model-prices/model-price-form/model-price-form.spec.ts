import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { ModelPriceService } from '@core/services/model-price.service';
import { expectPinnedToolbar } from '@core/testing/form-toolbar';
import { OPUS } from '../testing/model-price.fixtures';
import { ModelPriceForm } from './model-price-form';

describe('ModelPriceForm', () => {
  let service: jasmine.SpyObj<ModelPriceService>;
  let router: Router;

  const valid = {
    model: ' claude-new ',
    effectiveFrom: new Date(2026, 9, 1),
    inputPrice: 5,
    outputPrice: 25,
    cacheWritePrice: 10,
    cacheReadPrice: 0.5,
  };

  async function setup(id: string | null) {
    service = jasmine.createSpyObj<ModelPriceService>('ModelPriceService', [
      'getById',
      'create',
      'update',
    ]);
    service.getById.and.returnValue(of(OPUS));
    service.create.and.returnValue(of({ ...OPUS, pkid: 4, model: 'claude-new' }));
    service.update.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [ModelPriceForm],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        { provide: ModelPriceService, useValue: service },
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
    const fixture = TestBed.createComponent(ModelPriceForm);
    fixture.detectChanges();
    return fixture;
  }

  describe('add mode', () => {
    beforeEach(() => setup(null));

    it('starts empty with no pkid field and shows the recompute hint', () => {
      const fixture = create();
      const c = fixture.componentInstance;

      expect(c.isEdit).toBeFalse();
      expect(service.getById).not.toHaveBeenCalled();
      expect(c.form.getRawValue()).toEqual({
        model: '',
        effectiveFrom: null,
        inputPrice: null,
        outputPrice: null,
        cacheWritePrice: null,
        cacheReadPrice: null,
      });
      expect(fixture.nativeElement.querySelector('#pkid')).toBeNull();
      expect(fixture.nativeElement.querySelector('h1').textContent).toContain('新增模型價格');
      expect(fixture.nativeElement.textContent).toContain(
        '儲存後將重新計算此模型相關的 Token 用量成本。',
      );
    });

    it('does not submit when required fields are missing', () => {
      const c = create().componentInstance;

      c.save();

      expect(c.form.invalid).toBeTrue();
      for (const name of Object.keys(c.form.controls) as (keyof typeof c.form.controls)[]) {
        expect(c.form.controls[name].hasError('required')).withContext(name).toBeTrue();
        expect(c.form.controls[name].touched).withContext(name).toBeTrue();
      }
      expect(service.create).not.toHaveBeenCalled();
    });

    it('rejects a whitespace-only or too-long model and negative prices', () => {
      const c = create().componentInstance;
      c.form.setValue({ ...valid, model: '   ', inputPrice: -1 });

      c.save();

      expect(c.form.controls.model.invalid).toBeTrue();
      expect(c.form.controls.inputPrice.hasError('min')).toBeTrue();
      c.form.controls.model.setValue('m'.repeat(101));
      expect(c.form.controls.model.hasError('maxlength')).toBeTrue();
      expect(c.textError('model', '模型', 100)).toBe('最多 100 字');
      expect(service.create).not.toHaveBeenCalled();
    });

    it('accepts zero prices', () => {
      const c = create().componentInstance;
      c.form.setValue({
        ...valid,
        inputPrice: 0,
        outputPrice: 0,
        cacheWritePrice: 0,
        cacheReadPrice: 0,
      });

      c.save();

      expect(service.create).toHaveBeenCalled();
    });

    it('creates with a trimmed model and an ISO date, then navigates to the new detail page', () => {
      const c = create().componentInstance;
      c.form.setValue(valid);

      c.save();

      expect(service.create).toHaveBeenCalledOnceWith({
        pkid: 0,
        model: 'claude-new',
        effectiveFrom: '2026-10-01',
        inputPrice: 5,
        outputPrice: 25,
        cacheWritePrice: 10,
        cacheReadPrice: 0.5,
      });
      expect(router.navigate).toHaveBeenCalledWith(['/model-prices', 4]);
    });

    it('shows the 409 message and stays on the page when the model already has a price that day', () => {
      service.create.and.returnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: { message: '此模型在該生效日已有定價' },
            }),
        ),
      );
      const add = spyOn(TestBed.inject(MessageService), 'add');
      const c = create().componentInstance;
      c.form.setValue(valid);

      c.save();

      expect(add).toHaveBeenCalledWith(
        jasmine.objectContaining({ severity: 'error', detail: '此模型在該生效日已有定價' }),
      );
      expect(router.navigate).not.toHaveBeenCalled();
      expect(c.saving()).toBeFalse();
    });

    it('pins the Save/Cancel toolbar to the top of the form', () => {
      expectPinnedToolbar(create().nativeElement);
    });

    it('cancel() returns to the list', () => {
      create().componentInstance.cancel();
      expect(router.navigate).toHaveBeenCalledWith(['/model-prices']);
    });
  });

  describe('edit mode', () => {
    beforeEach(() => setup('1'));

    it('loads the price and patches the form (date as a local Date)', () => {
      const fixture = create();
      const c = fixture.componentInstance;

      expect(c.isEdit).toBeTrue();
      expect(service.getById).toHaveBeenCalledOnceWith(1);
      expect(c.form.getRawValue()).toEqual({
        model: 'claude-opus-5-5',
        effectiveFrom: new Date(2026, 0, 1),
        inputPrice: 4,
        outputPrice: 20,
        cacheWritePrice: 8,
        cacheReadPrice: 0.2,
      });
      expect(fixture.nativeElement.querySelector('#pkid').value).toBe('1');
      expect(fixture.nativeElement.querySelector('h1').textContent).toContain('編輯模型價格');
      expect(c.loading()).toBeFalse();
    });

    it('shows prices with at least 2 and up to 6 decimals', () => {
      service.getById.and.returnValue(of({ ...OPUS, cacheReadPrice: 0.123456 }));
      const fixture = create();
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      const value = (id: string) => el.querySelector<HTMLInputElement>(`#${id}`)!.value;

      expect(value('inputPrice')).toBe('4.00');
      expect(value('cacheReadPrice')).toBe('0.123456');
    });

    it('updates with pkid in the body and navigates to the detail page', () => {
      const c = create().componentInstance;
      c.form.patchValue({ model: 'claude-opus-5-5-renamed', inputPrice: 4.5 });

      c.save();

      expect(service.update).toHaveBeenCalledOnceWith({
        pkid: 1,
        model: 'claude-opus-5-5-renamed',
        effectiveFrom: '2026-01-01',
        inputPrice: 4.5,
        outputPrice: 20,
        cacheWritePrice: 8,
        cacheReadPrice: 0.2,
      });
      expect(service.create).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/model-prices', 1]);
    });

    it('does not submit when a price is cleared', () => {
      const c = create().componentInstance;
      c.form.controls.outputPrice.setValue(null);

      c.save();

      expect(service.update).not.toHaveBeenCalled();
    });

    it('pins the Save/Cancel toolbar to the top of the form', () => {
      expectPinnedToolbar(create().nativeElement);
    });

    it('cancel() returns to the detail page', () => {
      create().componentInstance.cancel();
      expect(router.navigate).toHaveBeenCalledWith(['/model-prices', 1]);
    });
  });
});

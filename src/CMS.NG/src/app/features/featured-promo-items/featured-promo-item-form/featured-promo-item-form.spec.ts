import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { FeaturedPromoItemService } from '@core/services/featured-promo-item.service';
import { LookupService } from '@core/services/lookup.service';
import { MON_SLOT2, PROMOTIONS } from '../testing/featured-promo-item.fixtures';
import { FeaturedPromoItemDraft, FeaturedPromoItemForm } from './featured-promo-item-form';

const EDIT_DRAFT: FeaturedPromoItemDraft = {
  pkid: 102,
  scheduleOn: '2026-03-16',
  trainingCenterPkid: 1,
  slot: 2,
  promotion: PROMOTIONS[1],
  topic: 'Google AI工具一次掌握',
  description: '不需技術基礎',
};

const NEW_DRAFT: FeaturedPromoItemDraft = {
  pkid: 0,
  scheduleOn: '2026-03-18',
  trainingCenterPkid: 1,
  slot: 3,
  promotion: null,
  topic: '',
  description: '',
};

describe('FeaturedPromoItemForm', () => {
  let service: jasmine.SpyObj<FeaturedPromoItemService>;
  let lookups: jasmine.SpyObj<LookupService>;
  let messages: MessageService;

  beforeEach(async () => {
    service = jasmine.createSpyObj<FeaturedPromoItemService>('FeaturedPromoItemService', [
      'create',
      'update',
    ]);
    service.create.and.returnValue(of({ ...MON_SLOT2, pkid: 200 }));
    service.update.and.returnValue(of(void 0));
    lookups = jasmine.createSpyObj<LookupService>('LookupService', ['getPromotions']);
    lookups.getPromotions.and.returnValue(of(PROMOTIONS));

    await TestBed.configureTestingModule({
      imports: [FeaturedPromoItemForm],
      providers: [
        provideNoopAnimations(),
        MessageService,
        { provide: FeaturedPromoItemService, useValue: service },
        { provide: LookupService, useValue: lookups },
      ],
    }).compileComponents();

    messages = TestBed.inject(MessageService);
  });

  function create(draft: FeaturedPromoItemDraft): ComponentFixture<FeaturedPromoItemForm> {
    const fixture = TestBed.createComponent(FeaturedPromoItemForm);
    fixture.componentRef.setInput('draft', draft);
    fixture.detectChanges();
    return fixture;
  }

  describe('Edit (existing values)', () => {
    it('shows the existing PromoCode, Topic and Description', async () => {
      const fixture = create(EDIT_DRAFT);
      await fixture.whenStable();
      const c = fixture.componentInstance;
      const el: HTMLElement = fixture.nativeElement;

      expect(c.isEdit).toBeTrue();
      expect(c.form.getRawValue()).toEqual({
        promotion: PROMOTIONS[1],
        topic: 'Google AI工具一次掌握',
        description: '不需技術基礎',
      });
      expect((el.querySelector('#ff-promotion') as HTMLInputElement).value).toBe('251211_GoogleAI');
      expect((el.querySelector('#ff-topic') as HTMLInputElement).value).toBe(
        'Google AI工具一次掌握',
      );
      expect(c.form.valid).toBeTrue();
    });

    it('updates with the row pkid, date, center and slot, trimmed text, then emits saved', () => {
      const c = create(EDIT_DRAFT).componentInstance;
      const saved = jasmine.createSpy('saved');
      c.saved.subscribe(saved);
      c.form.patchValue({ promotion: PROMOTIONS[0], topic: '  新主題 ' });

      c.save();

      expect(service.update).toHaveBeenCalledOnceWith({
        pkid: 102,
        scheduleOn: '2026-03-16',
        trainingCenterPkid: 1,
        slot: 2,
        promotionPkid: 3403,
        topic: '新主題',
        description: '不需技術基礎',
      });
      expect(service.create).not.toHaveBeenCalled();
      expect(saved).toHaveBeenCalledTimes(1);
    });

    it('shows an error toast, stays open and re-enables saving when update fails', () => {
      service.update.and.returnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: { message: '2026-03-16 第 2 則已有資料' },
            }),
        ),
      );
      const c = create(EDIT_DRAFT).componentInstance;
      const saved = jasmine.createSpy('saved');
      c.saved.subscribe(saved);
      const add = spyOn(messages, 'add');

      c.save();

      expect(add).toHaveBeenCalledWith(
        jasmine.objectContaining({ severity: 'error', detail: '2026-03-16 第 2 則已有資料' }),
      );
      expect(saved).not.toHaveBeenCalled();
      expect(c.saving()).toBeFalse();
    });

    it('cancel() emits cancelled without saving', () => {
      const c = create(EDIT_DRAFT).componentInstance;
      const cancelled = jasmine.createSpy('cancelled');
      c.cancelled.subscribe(cancelled);

      c.cancel();

      expect(cancelled).toHaveBeenCalledTimes(1);
      expect(service.update).not.toHaveBeenCalled();
    });
  });

  describe('New (empty values)', () => {
    it('starts empty and invalid', () => {
      const c = create(NEW_DRAFT).componentInstance;

      expect(c.isEdit).toBeFalse();
      expect(c.form.getRawValue()).toEqual({ promotion: null, topic: '', description: '' });
      expect(c.form.invalid).toBeTrue();
    });

    it('looks up PromoCodes as the user types', () => {
      const c = create(NEW_DRAFT).componentInstance;

      c.searchPromotions({ originalEvent: new Event('input'), query: ' 2512 ' });

      expect(lookups.getPromotions).toHaveBeenCalledOnceWith('2512');
      expect(c.suggestions()).toEqual(PROMOTIONS);
    });

    it('clears suggestions when the lookup fails', () => {
      lookups.getPromotions.and.returnValue(throwError(() => new Error('boom')));
      const c = create(NEW_DRAFT).componentInstance;
      c.suggestions.set(PROMOTIONS);

      c.searchPromotions({ originalEvent: new Event('input'), query: 'x' });

      expect(c.suggestions()).toEqual([]);
    });

    it('selecting a PromoCode fills Topic and Description from Promotion2', () => {
      const c = create(NEW_DRAFT).componentInstance;

      c.form.controls.promotion.setValue(PROMOTIONS[0]);
      c.onPromotionSelect({ originalEvent: new Event('click'), value: PROMOTIONS[0] });

      expect(c.form.getRawValue()).toEqual({
        promotion: PROMOTIONS[0],
        topic: '成為能AI協作的程式設計師',
        description: '轉職就業養成班，三大主流語言任你選',
      });
      expect(c.form.valid).toBeTrue();
    });

    it('rejects typed text that was not picked from the lookup', () => {
      const c = create(NEW_DRAFT).componentInstance;

      c.form.patchValue({ promotion: '251211_GoogleAI', topic: 't', description: 'd' });

      expect(c.form.controls.promotion.hasError('promotion')).toBeTrue();
      expect(c.form.invalid).toBeTrue();
    });

    it('rejects whitespace-only and too-long Topic / Description', () => {
      const c = create(NEW_DRAFT).componentInstance;
      c.form.patchValue({ promotion: PROMOTIONS[0], topic: '   ', description: 'x'.repeat(301) });

      expect(c.form.controls.topic.invalid).toBeTrue();
      expect(c.textError('topic', '主題', 100)).toBe('請輸入主題');
      expect(c.textError('description', '說明', 300)).toBe('最多 300 字');

      c.form.controls.topic.setValue('x'.repeat(101));
      expect(c.textError('topic', '主題', 100)).toBe('最多 100 字');
    });

    it('does not submit an invalid form and shows the errors', () => {
      const fixture = create(NEW_DRAFT);
      const c = fixture.componentInstance;

      c.save();
      fixture.detectChanges();

      expect(service.create).not.toHaveBeenCalled();
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('請輸入並從清單選擇推廣代碼');
      expect(text).toContain('請輸入主題');
      expect(text).toContain('請輸入說明');
    });

    it('creates at the draft date / center / slot and emits the created row', () => {
      const c = create(NEW_DRAFT).componentInstance;
      let emitted: unknown;
      c.saved.subscribe((v) => (emitted = v));
      const add = spyOn(messages, 'add');
      c.form.patchValue({ promotion: PROMOTIONS[1], topic: 'T', description: ' D ' });

      c.save();

      expect(service.create).toHaveBeenCalledOnceWith({
        pkid: 0,
        scheduleOn: '2026-03-18',
        trainingCenterPkid: 1,
        slot: 3,
        promotionPkid: 3404,
        topic: 'T',
        description: 'D',
      });
      expect(emitted).toEqual(jasmine.objectContaining({ pkid: 200 }));
      expect(add).toHaveBeenCalledWith(
        jasmine.objectContaining({ severity: 'success', detail: '251211_GoogleAI' }),
      );
    });
  });

  describe('Paste (copied values)', () => {
    it('opens with the copied values and creates a new row at the target slot', () => {
      const c = create({
        ...NEW_DRAFT,
        promotion: PROMOTIONS[0],
        topic: '複製的主題',
        description: '複製的說明',
      }).componentInstance;

      expect(c.form.valid).toBeTrue();
      c.save();

      expect(service.create).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({
          pkid: 0,
          scheduleOn: '2026-03-18',
          slot: 3,
          promotionPkid: 3403,
          topic: '複製的主題',
        }),
      );
    });
  });
});

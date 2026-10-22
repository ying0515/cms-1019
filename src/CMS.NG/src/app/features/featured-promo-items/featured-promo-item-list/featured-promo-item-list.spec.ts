import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { FeaturedPromoItemService } from '@core/services/featured-promo-item.service';
import { LookupService } from '@core/services/lookup.service';
import {
  MON_SLOT1,
  MON_SLOT2,
  PROMOTIONS,
  SUN_SLOT3,
  TRAINING_CENTERS,
  WEEK_OF,
} from '../testing/featured-promo-item.fixtures';
import { FeaturedPromoItemForm } from '../featured-promo-item-form/featured-promo-item-form';
import { FILTERS_KEY, FeaturedPromoItemList } from './featured-promo-item-list';

describe('FeaturedPromoItemList', () => {
  let fixture: ComponentFixture<FeaturedPromoItemList>;
  let component: FeaturedPromoItemList;
  let service: jasmine.SpyObj<FeaturedPromoItemService>;
  let lookups: jasmine.SpyObj<LookupService>;
  let confirmation: ConfirmationService;
  let messages: MessageService;

  beforeEach(async () => {
    sessionStorage.clear();
    // "Today" is Wednesday 2026-03-18, so the default week is Mon 3/16 – Sun 3/22
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 2, 18, 10, 0));

    service = jasmine.createSpyObj<FeaturedPromoItemService>('FeaturedPromoItemService', [
      'query',
      'delete',
      'moveUp',
      'moveDown',
      'create',
      'update',
    ]);
    service.query.and.returnValue(of([MON_SLOT1, MON_SLOT2, SUN_SLOT3]));
    service.delete.and.returnValue(of(void 0));
    service.moveUp.and.returnValue(of(void 0));
    service.moveDown.and.returnValue(of(void 0));
    lookups = jasmine.createSpyObj<LookupService>('LookupService', [
      'getTrainingCenters',
      'getPromotions',
    ]);
    lookups.getTrainingCenters.and.returnValue(of(TRAINING_CENTERS));
    lookups.getPromotions.and.returnValue(of(PROMOTIONS));

    await TestBed.configureTestingModule({
      imports: [FeaturedPromoItemList],
      providers: [
        provideNoopAnimations(),
        MessageService,
        ConfirmationService,
        { provide: FeaturedPromoItemService, useValue: service },
        { provide: LookupService, useValue: lookups },
      ],
    }).compileComponents();

    confirmation = TestBed.inject(ConfirmationService);
    messages = TestBed.inject(MessageService);
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    sessionStorage.clear();
  });

  function create(): void {
    fixture = TestBed.createComponent(FeaturedPromoItemList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const day = (n: number) => component.days()[n];
  const row = (n: number, slot: number) => day(n).rows[slot - 1];

  function rowEl(date: string, slot: number): HTMLElement {
    return fixture.nativeElement.querySelector(
      `.day[data-date="${date}"] .slot-row[data-slot="${slot}"]`,
    );
  }

  function inlineForm(): FeaturedPromoItemForm {
    return fixture.debugElement.query(By.directive(FeaturedPromoItemForm)).componentInstance;
  }

  function text(el: Element | null): string {
    return el?.textContent?.trim() ?? '';
  }

  describe('query', () => {
    it('shows one tab per training center and queries the first one for the current week', () => {
      create();

      const tabs = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('p-tab')).map(
        (t) => t.textContent!.trim(),
      );
      expect(tabs).toEqual(['台北', '新竹', '線上研討會']);
      expect(component.trainingCenterPkid()).toBe(1);
      expect(service.query).toHaveBeenCalledOnceWith({ trainingCenterPkid: 1, weekOf: WEEK_OF });
      expect(JSON.parse(sessionStorage.getItem(FILTERS_KEY)!)).toEqual({
        trainingCenterPkid: 1,
        weekOf: WEEK_OF,
      });
    });

    it('lays out Monday to Sunday with slots 1–3 each', () => {
      create();

      expect(text(fixture.nativeElement.querySelector('.week-label'))).toBe('3/16 – 3/22');
      const headers = Array.from<HTMLElement>(
        fixture.nativeElement.querySelectorAll('.day-header'),
      ).map((h) => h.textContent!.trim());
      expect(headers).toEqual([
        '3/16 (一)',
        '3/17 (二)',
        '3/18 (三)',
        '3/19 (四)',
        '3/20 (五)',
        '3/21 (六)',
        '3/22 (日)',
      ]);
      expect(fixture.nativeElement.querySelectorAll('.slot-row').length).toBe(21);
      expect(day(0).rows.map((r) => r.slot)).toEqual([1, 2, 3]);
    });

    it('shows PromoCode (looked up from Promotion2), Topic and Description in their slots', () => {
      create();

      const mon1 = rowEl('2026-03-16', 1);
      expect(text(mon1.querySelector('.slot-no'))).toBe('1');
      expect(text(mon1.querySelector('.promo-code'))).toBe('20251204_SkillTrainAI');
      expect(text(mon1.querySelector('.topic'))).toBe('成為能AI協作的程式設計師');
      expect(text(mon1.querySelector('.description'))).toBe('轉職就業養成班');
      expect(text(rowEl('2026-03-16', 2).querySelector('.promo-code'))).toBe('251211_GoogleAI');
      expect(text(rowEl('2026-03-22', 3).querySelector('.topic'))).toBe('週日主題');

      const empty = rowEl('2026-03-16', 3);
      expect(empty.classList).toContain('empty');
      expect(text(empty.querySelector('.promo-code'))).toBe('');
    });

    it('offers 複製 / 刪除 on filled slots and 貼上 on empty ones', () => {
      create();

      const filled = rowEl('2026-03-16', 1);
      expect(filled.querySelector('.copy')).not.toBeNull();
      expect(filled.querySelector('.delete')).not.toBeNull();
      expect(filled.querySelector('.paste')).toBeNull();

      const empty = rowEl('2026-03-17', 1);
      expect(empty.querySelector('.copy')).toBeNull();
      expect(empty.querySelector('.paste')).not.toBeNull();
      expect(empty.querySelector('.edit')).not.toBeNull();
    });

    it('selecting a tab filters by that training center and remembers it', () => {
      create();
      service.query.calls.reset();

      component.selectTrainingCenter(54);

      expect(service.query).toHaveBeenCalledOnceWith({ trainingCenterPkid: 54, weekOf: WEEK_OF });
      expect(JSON.parse(sessionStorage.getItem(FILTERS_KEY)!).trainingCenterPkid).toBe(54);
    });

    it('re-selecting the active tab does not re-query', () => {
      create();
      service.query.calls.reset();

      component.selectTrainingCenter(1);
      component.selectTrainingCenter(undefined);

      expect(service.query).not.toHaveBeenCalled();
    });

    it('moves between weeks (Monday to Sunday)', () => {
      create();

      component.previousWeek();
      expect(service.query).toHaveBeenCalledWith({ trainingCenterPkid: 1, weekOf: '2026-03-09' });
      expect(component.weekLabel()).toBe('3/9 – 3/15');

      component.nextWeek();
      component.nextWeek();
      expect(service.query).toHaveBeenCalledWith({ trainingCenterPkid: 1, weekOf: '2026-03-23' });
      expect(component.weekLabel()).toBe('3/23 – 3/29');

      component.thisWeek();
      expect(service.query).toHaveBeenCalledWith({ trainingCenterPkid: 1, weekOf: WEEK_OF });
    });

    it('labels a week that spans two months', () => {
      create();

      component.nextWeek();
      component.nextWeek();

      expect(component.weekLabel()).toBe('3/30 – 4/5');
      expect(day(6).label).toBe('4/5 (日)');
    });

    it('restores the training center and week from session storage', () => {
      sessionStorage.setItem(
        FILTERS_KEY,
        JSON.stringify({ trainingCenterPkid: 2, weekOf: '2026-04-08' }),
      );

      create();

      expect(component.trainingCenterPkid()).toBe(2);
      expect(service.query).toHaveBeenCalledOnceWith({
        trainingCenterPkid: 2,
        weekOf: '2026-04-06', // normalized to Monday
      });
    });

    it('falls back to the first training center when the saved one no longer exists', () => {
      sessionStorage.setItem(
        FILTERS_KEY,
        JSON.stringify({ trainingCenterPkid: 99, weekOf: WEEK_OF }),
      );

      create();

      expect(service.query).toHaveBeenCalledOnceWith({ trainingCenterPkid: 1, weekOf: WEEK_OF });
    });

    it('shows an error toast when the query fails', () => {
      service.query.and.returnValue(throwError(() => new Error('boom')));
      const add = spyOn(messages, 'add');

      create();

      expect(add).toHaveBeenCalledWith(
        jasmine.objectContaining({ severity: 'error', summary: '查詢失敗' }),
      );
      expect(component.loading()).toBeFalse();
    });

    it('shows an error toast and does not query when training centers fail to load', () => {
      lookups.getTrainingCenters.and.returnValue(throwError(() => new Error('boom')));
      const add = spyOn(messages, 'add');

      create();

      expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ summary: '載入失敗' }));
      expect(service.query).not.toHaveBeenCalled();
    });
  });

  describe('Edit / New / Copy / Paste', () => {
    it('編輯 on a filled slot opens the inline form with the existing values', () => {
      create();

      component.edit(day(0), row(0, 2));
      fixture.detectChanges();

      expect(component.draft()).toEqual({
        pkid: 102,
        scheduleOn: '2026-03-16',
        trainingCenterPkid: 1,
        slot: 2,
        promotion: PROMOTIONS[1],
        topic: 'Google AI工具一次掌握',
        description: '不需技術基礎',
      });
      const editing = rowEl('2026-03-16', 2);
      expect(editing.querySelector('app-featured-promo-item-form')).not.toBeNull();
      expect(editing.querySelector('.promo-code')).toBeNull();
      expect(fixture.nativeElement.querySelectorAll('app-featured-promo-item-form').length).toBe(1);
    });

    it('編輯 on an empty slot opens the inline form with empty values', () => {
      create();

      component.edit(day(2), row(2, 1));

      expect(component.draft()).toEqual({
        pkid: 0,
        scheduleOn: '2026-03-18',
        trainingCenterPkid: 1,
        slot: 1,
        promotion: null,
        topic: '',
        description: '',
      });
    });

    it('only one row is edited at a time', () => {
      create();

      component.edit(day(0), row(0, 1));
      component.edit(day(1), row(1, 3));

      expect(component.isEditing(day(0), row(0, 1))).toBeFalse();
      expect(component.isEditing(day(1), row(1, 3))).toBeTrue();
    });

    it('closes the form on cancel', () => {
      create();
      component.edit(day(0), row(0, 1));

      component.closeForm();

      expect(component.draft()).toBeNull();
    });

    it('reloads and closes the form when the inline form saves', () => {
      create();
      component.edit(day(0), row(0, 1));
      fixture.detectChanges();
      service.query.calls.reset();

      inlineForm().saved.emit();

      expect(service.query).toHaveBeenCalledTimes(1);
      expect(component.draft()).toBeNull();
    });

    it('closes the form when the inline form is cancelled', () => {
      create();
      component.edit(day(0), row(0, 1));
      fixture.detectChanges();

      inlineForm().cancelled.emit();

      expect(component.draft()).toBeNull();
    });

    it('貼上 is disabled until something is copied', () => {
      create();
      component.paste(day(1), row(1, 1));

      expect(component.draft()).toBeNull();
      const paste = rowEl('2026-03-17', 1).querySelector('button.paste') as HTMLButtonElement;
      expect(paste.disabled).toBeTrue();
    });

    it('複製 then 貼上 opens a new-item form with the copied values', () => {
      create();
      const add = spyOn(messages, 'add');

      component.copy(MON_SLOT1);
      fixture.detectChanges();
      component.paste(day(3), row(3, 2));

      expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ summary: '已複製' }));
      expect(text(fixture.nativeElement.querySelector('.copied'))).toContain(
        '20251204_SkillTrainAI',
      );
      expect(component.draft()).toEqual({
        pkid: 0,
        scheduleOn: '2026-03-19',
        trainingCenterPkid: 1,
        slot: 2,
        promotion: PROMOTIONS[0],
        topic: '成為能AI協作的程式設計師',
        description: '轉職就業養成班',
      });
    });

    it('a pasted item keeps the training center of the active tab', () => {
      create();
      component.copy(MON_SLOT1);
      component.selectTrainingCenter(2);

      component.paste(day(0), row(0, 3));

      expect(component.draft()?.trainingCenterPkid).toBe(2);
    });

    it('switching tab or week closes an open form', () => {
      create();
      component.edit(day(0), row(0, 1));

      component.nextWeek();

      expect(component.draft()).toBeNull();
    });
  });

  describe('move slot (+ / −)', () => {
    it('+ on a filled slot moves it down (1 → 2) and reloads', () => {
      create();
      service.query.calls.reset();

      component.moveDown(day(0), row(0, 1));

      expect(service.moveDown).toHaveBeenCalledOnceWith(101);
      expect(service.query).toHaveBeenCalledTimes(1);
    });

    it('− on a filled slot moves it up (2 → 1)', () => {
      create();

      component.moveUp(day(0), row(0, 2));

      expect(service.moveUp).toHaveBeenCalledOnceWith(102);
    });

    it('+ on an empty slot pulls the next item up instead', () => {
      create();

      component.moveDown(day(6), row(6, 2)); // Sunday: slot 2 empty, slot 3 filled

      expect(service.moveUp).toHaveBeenCalledOnceWith(103);
      expect(service.moveDown).not.toHaveBeenCalled();
    });

    it('− on an empty slot pushes the previous item down instead', () => {
      create();

      component.moveUp(day(0), row(0, 3)); // Monday: slot 3 empty, slot 2 filled

      expect(service.moveDown).toHaveBeenCalledOnceWith(102);
    });

    it('cannot move past slot 1 or slot 3, or between two empty slots', () => {
      create();

      expect(component.canMoveUp(day(0), row(0, 1))).toBeFalse();
      expect(component.canMoveDown(day(6), row(6, 3))).toBeFalse();
      expect(component.canMoveDown(day(1), row(1, 1))).toBeFalse(); // Tuesday is empty
      expect(component.canMoveDown(day(0), row(0, 2))).toBeTrue();

      component.moveUp(day(0), row(0, 1));
      component.moveDown(day(1), row(1, 1));
      expect(service.moveUp).not.toHaveBeenCalled();
      expect(service.moveDown).not.toHaveBeenCalled();

      fixture.detectChanges();
      const minus = rowEl('2026-03-16', 1).querySelector('button.move-up') as HTMLButtonElement;
      const plus = rowEl('2026-03-22', 3).querySelector('button.move-down') as HTMLButtonElement;
      expect(minus.disabled).toBeTrue();
      expect(plus.disabled).toBeTrue();
    });

    it('shows an error toast when a move fails', () => {
      create();
      service.moveDown.and.returnValue(throwError(() => ({ status: 400 })));
      const add = spyOn(messages, 'add');

      component.moveDown(day(0), row(0, 1));

      expect(add).toHaveBeenCalledWith(
        jasmine.objectContaining({ severity: 'error', summary: '移動失敗' }),
      );
    });
  });

  describe('delete', () => {
    it('confirms with pkid and escaped PromoCode, deletes on accept and reloads', () => {
      create();
      spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
        expect(c.message).toBe('確定要刪除主代碼 <b>102</b>「&#60;b&#62;GoogleAI」？');
        c.accept?.();
        return confirmation;
      });
      service.query.calls.reset();

      component.confirmDelete({
        ...MON_SLOT2,
        promotion: { ...PROMOTIONS[1], promoCode: '<b>GoogleAI' },
      });

      expect(service.delete).toHaveBeenCalledOnceWith(102);
      expect(service.query).toHaveBeenCalledTimes(1);
    });

    it('shows an error toast when delete fails', () => {
      create();
      service.delete.and.returnValue(throwError(() => ({ status: 500 })));
      spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
        c.accept?.();
        return confirmation;
      });
      const add = spyOn(messages, 'add');

      component.confirmDelete(MON_SLOT1);

      expect(add).toHaveBeenCalledWith(
        jasmine.objectContaining({ severity: 'error', summary: '刪除失敗' }),
      );
    });
  });
});

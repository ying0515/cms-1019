import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { provideRowAuditStub, rowAuditStub } from '@core/testing/row-audit';
import { ModelPriceService } from '@core/services/model-price.service';
import { HAIKU, OPUS } from '../testing/model-price.fixtures';
import { ModelPriceDetail } from './model-price-detail';

describe('ModelPriceDetail', () => {
  let service: jasmine.SpyObj<ModelPriceService>;

  async function setup(id: string | null) {
    service = jasmine.createSpyObj<ModelPriceService>('ModelPriceService', ['getById', 'delete']);
    service.getById.and.returnValue(of(OPUS));
    service.delete.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [ModelPriceDetail],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        provideRowAuditStub(),
        MessageService,
        ConfirmationService,
        { provide: ModelPriceService, useValue: service },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } },
        },
      ],
    }).compileComponents();
  }

  function create() {
    const fixture = TestBed.createComponent(ModelPriceDetail);
    fixture.detectChanges();
    return fixture;
  }

  it('loads the price by route id and renders all fields with 2–6 decimals', async () => {
    await setup('3');
    service.getById.and.returnValue(of(HAIKU));
    const el: HTMLElement = create().nativeElement;

    expect(service.getById).toHaveBeenCalledOnceWith(3);
    expect(el.querySelector('.model')?.textContent).toContain('claude-haiku-5-5');
    expect(el.querySelector('.effective-from')?.textContent).toContain('2026-01-01');
    expect(el.querySelector('.input-price')?.textContent?.trim()).toBe('0.10');
    expect(el.querySelector('.output-price')?.textContent?.trim()).toBe('0.50');
    expect(el.querySelector('.cache-write-price')?.textContent?.trim()).toBe('0.20');
    expect(el.querySelector('.cache-read-price')?.textContent?.trim()).toBe('0.01');
    expect(el.textContent).toContain('美元／百萬 Token');
  });

  it('shows not-found on 404', async () => {
    await setup('99');
    service.getById.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const fixture = create();

    expect(fixture.componentInstance.notFound()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('找不到此模型價格資料');
  });

  for (const bad of ['abc', '0', '2147483648', '-1', '1.5']) {
    it(`treats id "${bad}" as not found without calling the API`, async () => {
      await setup(bad);
      const fixture = create();

      expect(service.getById).not.toHaveBeenCalled();
      expect(fixture.componentInstance.notFound()).toBeTrue();
    });
  }

  it('edit() navigates to the edit form', async () => {
    await setup('1');
    const fixture = create();
    const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    fixture.componentInstance.edit();

    expect(nav).toHaveBeenCalledWith(['/model-prices', 1, 'edit']);
  });

  it('confirmDelete() warns about the recompute, deletes and returns to the list', async () => {
    await setup('1');
    const fixture = create();
    const confirmation = TestBed.inject(ConfirmationService);
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      expect(c.message).toBe(
        '確定要刪除主代碼 <b>1</b>「claude-opus-5-5 2026-01-01」？<br>相關的 Token 用量成本將重新計算。',
      );
      c.accept?.();
      return confirmation;
    });
    const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    fixture.componentInstance.confirmDelete();

    expect(service.delete).toHaveBeenCalledOnceWith(1);
    expect(nav).toHaveBeenCalledWith(['/model-prices']);
  });

  it('shows the row-audit badge for this record next to the title', async () => {
    await setup('1');
    const fixture = create();

    expect(fixture.nativeElement.querySelector('.page-header .start app-row-audit-badge')).toBeTruthy();
    expect(rowAuditStub().getHistory).toHaveBeenCalledOnceWith(
      'ModelPrice',
      fixture.componentInstance.item()!.pkid,
    );
  });
});

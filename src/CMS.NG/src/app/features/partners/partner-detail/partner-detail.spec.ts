import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { PartnerService } from '@core/services/partner.service';
import { CISCO, MICROSOFT } from '../testing/partner.fixtures';
import { PartnerDetail } from './partner-detail';

describe('PartnerDetail', () => {
  let service: jasmine.SpyObj<PartnerService>;

  async function setup(id: string | null) {
    service = jasmine.createSpyObj<PartnerService>('PartnerService', ['getById', 'delete']);
    service.getById.and.returnValue(of(MICROSOFT));
    service.delete.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [PartnerDetail],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        ConfirmationService,
        { provide: PartnerService, useValue: service },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } },
        },
      ],
    }).compileComponents();
  }

  function create() {
    const fixture = TestBed.createComponent(PartnerDetail);
    fixture.detectChanges();
    return fixture;
  }

  it('loads the partner by route id and renders all fields', async () => {
    await setup('1');
    const el: HTMLElement = create().nativeElement;

    expect(service.getById).toHaveBeenCalledOnceWith(1);
    expect(el.querySelector('.name')?.textContent).toContain('Microsoft');
    expect(el.querySelector('.app-key')?.textContent).toContain('MS');
    expect(el.querySelector('.name-on-partner-menu')?.textContent).toContain('微軟 Microsoft');
    expect(el.querySelector('.name-on-course-detail-page')?.textContent).toContain('微軟');
    expect(el.querySelector('.display-order')?.textContent).toContain('1');
    expect(el.querySelector('.image-filename')?.textContent).toContain('ms.png');
  });

  it('shows a dash when imageFilename is null', async () => {
    await setup('2');
    service.getById.and.returnValue(of(CISCO));
    const el: HTMLElement = create().nativeElement;

    expect(el.querySelector('.image-filename')?.textContent?.trim()).toBe('—');
  });

  it('shows not-found on 404', async () => {
    await setup('99');
    service.getById.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const fixture = create();

    expect(fixture.componentInstance.notFound()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('找不到此合作廠商資料');
  });

  for (const bad of ['abc', '0', '32768', '-1', '1.5']) {
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

    expect(nav).toHaveBeenCalledWith(['/partners', 1, 'edit']);
  });

  it('confirmDelete() deletes and returns to the list', async () => {
    await setup('1');
    const fixture = create();
    const confirmation = TestBed.inject(ConfirmationService);
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      expect(c.message).toContain('<b>1</b>「Microsoft」');
      c.accept?.();
      return confirmation;
    });
    const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    fixture.componentInstance.confirmDelete();

    expect(service.delete).toHaveBeenCalledOnceWith(1);
    expect(nav).toHaveBeenCalledWith(['/partners']);
  });

  it('viewCourses() opens the course list filtered by this row', async () => {
    await setup('1');
    const fixture = create();
    const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    expect(fixture.nativeElement.textContent).toContain('查看課程');
    fixture.componentInstance.viewCourses();

    expect(nav).toHaveBeenCalledWith(['/courses'], { queryParams: { partnerPkid: 1 } });
  });
});

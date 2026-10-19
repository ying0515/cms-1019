import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { PublishStatusService } from '@core/services/publish-status.service';
import { DRAFT_STATUS } from '../testing/publish-status.fixtures';
import { PublishStatusDetail } from './publish-status-detail';

describe('PublishStatusDetail', () => {
  let service: jasmine.SpyObj<PublishStatusService>;

  async function setup(id: string | null) {
    service = jasmine.createSpyObj<PublishStatusService>('PublishStatusService', ['getById', 'delete']);
    service.getById.and.returnValue(of(DRAFT_STATUS));
    service.delete.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [PublishStatusDetail],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        ConfirmationService,
        { provide: PublishStatusService, useValue: service },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } } },
      ],
    }).compileComponents();
  }

  function create() {
    const fixture = TestBed.createComponent(PublishStatusDetail);
    fixture.detectChanges();
    return fixture;
  }

  it('loads the status by route id and renders fields and flags', async () => {
    await setup('1');
    const el: HTMLElement = create().nativeElement;

    expect(service.getById).toHaveBeenCalledOnceWith(1);
    expect(el.querySelector('.description')?.textContent).toContain('草稿');
    expect(el.querySelector('.is-draft')?.textContent).toContain('是');
    expect(el.querySelector('.is-published')?.textContent).toContain('否');
    expect(el.querySelector('.is-discontinued')?.textContent).toContain('否');
  });

  it('accepts pkid 0', async () => {
    await setup('0');
    create();

    expect(service.getById).toHaveBeenCalledOnceWith(0);
  });

  it('shows not-found on 404', async () => {
    await setup('99');
    service.getById.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const fixture = create();

    expect(fixture.componentInstance.notFound()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('找不到此發布狀態資料');
  });

  for (const bad of ['abc', '256', '-1', '1.5']) {
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

    expect(nav).toHaveBeenCalledWith(['/publish-statuses', 1, 'edit']);
  });

  it('confirmDelete() deletes and returns to the list', async () => {
    await setup('1');
    const fixture = create();
    const confirmation = TestBed.inject(ConfirmationService);
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      expect(c.message).toContain('<b>1</b>「草稿」');
      c.accept?.();
      return confirmation;
    });
    const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    fixture.componentInstance.confirmDelete();

    expect(service.delete).toHaveBeenCalledOnceWith(1);
    expect(nav).toHaveBeenCalledWith(['/publish-statuses']);
  });
});

import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { CourseGroupService } from '@core/services/course-group.service';
import { CLOUD_GROUP } from '../testing/course-group.fixtures';
import { CourseGroupDetail } from './course-group-detail';

describe('CourseGroupDetail', () => {
  let service: jasmine.SpyObj<CourseGroupService>;

  async function setup(id: string | null) {
    service = jasmine.createSpyObj<CourseGroupService>('CourseGroupService', ['getById', 'delete']);
    service.getById.and.returnValue(of(CLOUD_GROUP));
    service.delete.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [CourseGroupDetail],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        ConfirmationService,
        { provide: CourseGroupService, useValue: service },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } },
        },
      ],
    }).compileComponents();
  }

  function create() {
    const fixture = TestBed.createComponent(CourseGroupDetail);
    fixture.detectChanges();
    return fixture;
  }

  it('loads the group by route id and renders its fields', async () => {
    await setup('1');
    const el: HTMLElement = create().nativeElement;

    expect(service.getById).toHaveBeenCalledOnceWith(1);
    expect(el.querySelector('.description')?.textContent).toContain('雲端運算');
  });

  it('shows not-found on 404', async () => {
    await setup('99');
    service.getById.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const fixture = create();

    expect(fixture.componentInstance.notFound()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('找不到此課程群組資料');
  });

  it('shows an error toast for non-404 failures', async () => {
    await setup('1');
    service.getById.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    const add = spyOn(TestBed.inject(MessageService), 'add');

    create();

    expect(add).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'error', summary: '載入失敗' }),
    );
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

    expect(nav).toHaveBeenCalledWith(['/course-groups', 1, 'edit']);
  });

  it('confirmDelete() deletes and returns to the list', async () => {
    await setup('1');
    const fixture = create();
    const confirmation = TestBed.inject(ConfirmationService);
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      expect(c.message).toContain('<b>1</b>「雲端運算」');
      c.accept?.();
      return confirmation;
    });
    const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    fixture.componentInstance.confirmDelete();

    expect(service.delete).toHaveBeenCalledOnceWith(1);
    expect(nav).toHaveBeenCalledWith(['/course-groups']);
  });
});

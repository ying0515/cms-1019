import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { CourseService } from '@core/services/course.service';
import { AZ104, CCNA } from '../testing/course.fixtures';
import { CourseDetail } from './course-detail';

describe('CourseDetail', () => {
  let service: jasmine.SpyObj<CourseService>;

  async function setup(id: string | null) {
    service = jasmine.createSpyObj<CourseService>('CourseService', ['getById', 'delete']);
    service.getById.and.returnValue(of(AZ104));
    service.delete.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [CourseDetail],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        ConfirmationService,
        { provide: CourseService, useValue: service },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } },
        },
      ],
    }).compileComponents();
  }

  function create() {
    const fixture = TestBed.createComponent(CourseDetail);
    fixture.detectChanges();
    return fixture;
  }

  it('loads the course by route id and renders fields with FK labels and links', async () => {
    await setup('1');
    const el: HTMLElement = create().nativeElement;

    expect(service.getById).toHaveBeenCalledOnceWith(1);
    expect(el.querySelector('.title-value')?.textContent).toContain('Microsoft Azure 管理員');
    expect(el.querySelector('.course-id')?.textContent).toContain('AZ-104');
    expect(el.querySelector('.prod-course-id')?.textContent).toContain('AZ-104T00');
    expect(el.querySelector('.partner a')?.getAttribute('href')).toBe('/partners/1');
    expect(el.querySelector('.partner')?.textContent).toContain('Microsoft');
    expect(el.querySelector('.course-group a')?.getAttribute('href')).toBe('/course-groups/1');
    expect(el.querySelector('.publish-status')?.textContent).toContain('已發布');
    expect(el.querySelector('.schedule-on')?.textContent).toContain('2026-01-01');
    expect(el.querySelector('.schedule-off')?.textContent).toContain('2036-01-01');
    expect(el.querySelector('.list-price')?.textContent).toContain('28,000');
    expect(el.querySelector('.learning-credit')?.textContent).toContain('4.0');
    expect(el.querySelector('.can-repeat')?.textContent).toContain('是');
    expect(el.querySelector('.content-objective')?.textContent).toContain('管理 Azure 訂用帳戶');
    expect(el.querySelector('.content-material')?.textContent).toContain('—');
  });

  it('renders n-n certifications and job categories as chips', async () => {
    await setup('1');
    const el: HTMLElement = create().nativeElement;

    expect(el.querySelector('.certifications')?.textContent).toContain(
      'Microsoft - Azure Administrator Associate',
    );
    expect(el.querySelector('.job-categories')?.textContent).toContain('系統管理');
  });

  it('shows dashes / 無 for a null course group and empty relations', async () => {
    await setup('2');
    service.getById.and.returnValue(of(CCNA));
    const el: HTMLElement = create().nativeElement;

    expect(el.querySelector('.course-group a')).toBeNull();
    expect(el.querySelector('.course-group')?.textContent).toContain('—');
    expect(el.querySelector('.official-title')?.textContent).toContain('—');
    expect(el.querySelector('.can-repeat')?.textContent).toContain('否');
    expect(el.querySelector('.certifications')?.textContent).toContain('無');
    expect(el.querySelector('.content-outline')?.textContent).toContain('第一章\n第二章');
  });

  it('shows the QR code for the course inside the 基本資料 panel', async () => {
    await setup('2');
    service.getById.and.returnValue(of(CCNA));
    const el: HTMLElement = create().nativeElement;

    const panel = el.querySelector('app-course-qr-code')?.closest('section');
    expect(panel?.querySelector('h2')?.textContent).toBe('基本資料');
    expect(panel?.querySelector('.qr-url')?.getAttribute('href')).toBe(
      'https://www.uuu.com.tw/Course/Show/2/CCNA',
    );
    expect(panel?.querySelector('canvas')?.getAttribute('aria-label')).toBe('QR Code：CCNA');
  });

  it('shows not-found on 404 without an error toast', async () => {
    await setup('99');
    service.getById.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found' })),
    );
    const add = spyOn(TestBed.inject(MessageService), 'add');
    const el: HTMLElement = create().nativeElement;

    expect(el.textContent).toContain('找不到此課程資料');
    expect(add).not.toHaveBeenCalled();
  });

  for (const bad of ['abc', '0', '-1', '1.5']) {
    it(`treats invalid id "${bad}" as not found without calling the API`, async () => {
      await setup(bad);
      const el: HTMLElement = create().nativeElement;

      expect(service.getById).not.toHaveBeenCalled();
      expect(el.textContent).toContain('找不到此課程資料');
    });
  }

  it('edit() navigates to the edit form', async () => {
    await setup('1');
    const fixture = create();
    const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    fixture.componentInstance.edit();

    expect(nav).toHaveBeenCalledWith(['/courses', 1, 'edit']);
  });

  it('confirmDelete() shows pkid and escaped title, deletes and returns to the list', async () => {
    await setup('1');
    service.getById.and.returnValue(of({ ...AZ104, title: 'A&B' }));
    const fixture = create();
    const confirmation = TestBed.inject(ConfirmationService);
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      expect(c.message).toBe('確定要刪除主代碼 <b>1</b>「A&#38;B」？');
      c.accept?.();
      return confirmation;
    });
    const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    fixture.componentInstance.confirmDelete();

    expect(service.delete).toHaveBeenCalledOnceWith(1);
    expect(nav).toHaveBeenCalledWith(['/courses']);
  });
});

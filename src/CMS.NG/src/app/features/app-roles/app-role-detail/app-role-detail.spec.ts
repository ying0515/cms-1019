import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { AppRoleService } from '@core/services/app-role.service';
import { ADMIN_ROLE } from '../testing/app-role.fixtures';
import { AppRoleDetail } from './app-role-detail';

describe('AppRoleDetail', () => {
  let roleService: jasmine.SpyObj<AppRoleService>;

  async function setup(id: string | null) {
    roleService = jasmine.createSpyObj<AppRoleService>('AppRoleService', ['getById', 'delete']);
    roleService.getById.and.returnValue(of(ADMIN_ROLE));
    roleService.delete.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [AppRoleDetail],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        ConfirmationService,
        { provide: AppRoleService, useValue: roleService },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } } },
      ],
    }).compileComponents();
  }

  function create() {
    const fixture = TestBed.createComponent(AppRoleDetail);
    fixture.detectChanges();
    return fixture;
  }

  it('loads the role by route id and renders fields and users', async () => {
    await setup('1');
    const fixture = create();
    const el: HTMLElement = fixture.nativeElement;

    expect(roleService.getById).toHaveBeenCalledOnceWith(1);
    expect(el.querySelector('.role-id')?.textContent).toContain('Admin');
    expect(el.querySelector('.role-name')?.textContent).toContain('Administrator');
    expect(el.textContent).toContain('系統管理員');
    const users = el.querySelectorAll('.user-list li');
    expect(users.length).toBe(2);
    expect(users[1].textContent).toContain('Jenny_Tsao (jenny)');
  });

  it('shows not-found on 404', async () => {
    await setup('99');
    roleService.getById.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const fixture = create();

    expect(fixture.componentInstance.notFound()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('找不到此角色資料');
  });

  it('treats a non-numeric id as not found without calling the API', async () => {
    await setup('abc');
    const fixture = create();

    expect(roleService.getById).not.toHaveBeenCalled();
    expect(fixture.componentInstance.notFound()).toBeTrue();
  });

  it('edit() navigates to the edit form', async () => {
    await setup('1');
    const fixture = create();
    const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    fixture.componentInstance.edit();

    expect(nav).toHaveBeenCalledWith(['/app-roles', 1, 'edit']);
  });

  it('confirmDelete() deletes and returns to the list', async () => {
    await setup('1');
    const fixture = create();
    const confirmation = TestBed.inject(ConfirmationService);
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      c.accept?.();
      return confirmation;
    });
    const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    fixture.componentInstance.confirmDelete();

    expect(roleService.delete).toHaveBeenCalledOnceWith(1);
    expect(nav).toHaveBeenCalledWith(['/app-roles']);
  });
});

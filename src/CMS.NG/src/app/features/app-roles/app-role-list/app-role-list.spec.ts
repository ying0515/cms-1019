import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { AppRoleService } from '@core/services/app-role.service';
import { LookupService } from '@core/services/lookup.service';
import { ADMIN_ROLE, APP_USERS, USER_ROLE } from '../testing/app-role.fixtures';
import { AppRoleList, FILTERS_KEY, PAGE_KEY, SORT_KEY } from './app-role-list';

describe('AppRoleList', () => {
  let fixture: ComponentFixture<AppRoleList>;
  let component: AppRoleList;
  let roleService: jasmine.SpyObj<AppRoleService>;
  let lookupService: jasmine.SpyObj<LookupService>;
  let confirmation: ConfirmationService;
  let messages: MessageService;

  beforeEach(async () => {
    sessionStorage.clear();
    roleService = jasmine.createSpyObj<AppRoleService>('AppRoleService', ['query', 'delete']);
    lookupService = jasmine.createSpyObj<LookupService>('LookupService', ['getAppUsers']);
    roleService.query.and.returnValue(of([ADMIN_ROLE, USER_ROLE]));
    roleService.delete.and.returnValue(of(void 0));
    lookupService.getAppUsers.and.returnValue(of(APP_USERS));

    await TestBed.configureTestingModule({
      imports: [AppRoleList],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        ConfirmationService,
        { provide: AppRoleService, useValue: roleService },
        { provide: LookupService, useValue: lookupService },
      ],
    }).compileComponents();

    confirmation = TestBed.inject(ConfirmationService);
    messages = TestBed.inject(MessageService);
  });

  afterEach(() => sessionStorage.clear());

  function create(): void {
    fixture = TestBed.createComponent(AppRoleList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function rows(): HTMLTableRowElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('tbody tr'));
  }

  it('loads lookups then queries with empty filters on init', () => {
    create();

    expect(lookupService.getAppUsers).toHaveBeenCalled();
    expect(roleService.query).toHaveBeenCalledOnceWith({
      keyword: null,
      permissionLevelFrom: null,
      permissionLevelTo: null,
      userId: null,
    });
    expect(component.items().length).toBe(2);
  });

  it('renders a row per role with columns', () => {
    create();

    const r = rows();
    expect(r.length).toBe(2);
    expect(r[0].textContent).toContain('Admin');
    expect(r[0].textContent).toContain('Administrator');
    expect(r[0].textContent).toContain('系統管理員');
    expect(r[1].textContent).toContain('一般使用者');
  });

  it('shows the empty message when there are no results', () => {
    roleService.query.and.returnValue(of([]));
    create();

    expect(fixture.nativeElement.textContent).toContain('查無資料');
  });

  it('maps users to { pkid, label } options', () => {
    create();

    expect(component.userOptions).toEqual([
      { pkid: 'helen', label: 'helen (helen)' },
      { pkid: 'jenny', label: 'Jenny_Tsao (jenny)' },
      { pkid: 'miles', label: 'Miles Sun (miles)' },
    ]);
  });

  it('search() sends trimmed filters, saves them to session storage and resets paging', () => {
    create();
    component.first = 40;
    component.filters = { keyword: '  adm ', permissionLevelFrom: 1, permissionLevelTo: 50, userId: 'helen' };

    component.search();

    expect(roleService.query).toHaveBeenCalledWith({
      keyword: 'adm',
      permissionLevelFrom: 1,
      permissionLevelTo: 50,
      userId: 'helen',
    });
    expect(JSON.parse(sessionStorage.getItem(FILTERS_KEY)!).keyword).toBe('  adm ');
    expect(component.first).toBe(0);
    expect(component.activeFilterCount()).toBe(4);
  });

  it('restores filters, sort and page from session storage', () => {
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ keyword: 'user', userId: 'miles' }));
    sessionStorage.setItem(SORT_KEY, JSON.stringify({ sortField: 'permissionLevel', sortOrder: -1 }));
    sessionStorage.setItem(PAGE_KEY, JSON.stringify({ first: 10, rows: 10 }));

    create();

    expect(component.filters.keyword).toBe('user');
    expect(component.filters.userId).toBe('miles');
    expect(component.sortField).toBe('permissionLevel');
    expect(component.sortOrder).toBe(-1);
    expect(component.rows).toBe(10);
    expect(component.first).toBe(10);
    expect(roleService.query).toHaveBeenCalledWith(jasmine.objectContaining({ keyword: 'user', userId: 'miles' }));
  });

  function badgeText(): string | null {
    const badge = fixture.nativeElement.querySelector('.page-header p-button .p-badge');
    return badge ? badge.textContent.trim() : null;
  }

  it('shows no filter-count badge when no filters are applied', () => {
    create();

    expect(component.activeFilterCount()).toBe(0);
    expect(badgeText()).toBeNull();
  });

  it('shows the applied filter count on the 搜尋條件 button', () => {
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ keyword: 'user', userId: 'miles' }));
    create();

    expect(badgeText()).toBe('2');
  });

  it('only updates the badge count after search(), not while editing the drawer', () => {
    create();
    component.filters.keyword = 'adm';
    fixture.detectChanges();
    expect(badgeText()).toBeNull();

    component.search();
    fixture.detectChanges();
    expect(badgeText()).toBe('1');
  });

  it('does not count a whitespace-only keyword', () => {
    create();
    component.filters.keyword = '   ';

    component.search();

    expect(component.activeFilterCount()).toBe(0);
  });

  it('clearFilters() resets filters and re-queries', () => {
    create();
    component.filters.keyword = 'x';
    roleService.query.calls.reset();

    component.clearFilters();

    expect(component.filters.keyword).toBeNull();
    expect(component.activeFilterCount()).toBe(0);
    expect(roleService.query).toHaveBeenCalledTimes(1);
  });

  it('persists sort and page changes', () => {
    create();

    component.onSort({ field: 'roleName', order: -1 });
    component.onPage({ first: 20, rows: 20 });

    expect(JSON.parse(sessionStorage.getItem(SORT_KEY)!)).toEqual({ sortField: 'roleName', sortOrder: -1 });
    expect(JSON.parse(sessionStorage.getItem(PAGE_KEY)!)).toEqual({ first: 20, rows: 20 });
  });

  it('add() navigates to the new form', () => {
    create();
    const router = TestBed.inject(Router);
    const nav = spyOn(router, 'navigate').and.resolveTo(true);

    component.add();

    expect(nav).toHaveBeenCalledWith(['/app-roles/new']);
  });

  it('confirmDelete() deletes on accept and reloads the list', () => {
    create();
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      expect(c.message).toContain('Admin');
      c.accept?.();
      return confirmation;
    });
    roleService.query.calls.reset();

    component.confirmDelete(ADMIN_ROLE);

    expect(roleService.delete).toHaveBeenCalledOnceWith(1);
    expect(roleService.query).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast when the query fails', () => {
    roleService.query.and.returnValue(throwError(() => new Error('boom')));
    const add = spyOn(messages, 'add');

    create();

    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
    expect(component.loading()).toBeFalse();
  });
});

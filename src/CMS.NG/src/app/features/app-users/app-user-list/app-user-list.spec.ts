import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { AppUserService } from '@core/services/app-user.service';
import { LookupService } from '@core/services/lookup.service';
import { APP_ROLES, HELEN, MILES } from '../testing/app-user.fixtures';
import { AppUserList, FILTERS_KEY, PAGE_KEY, SORT_KEY } from './app-user-list';

describe('AppUserList', () => {
  let fixture: ComponentFixture<AppUserList>;
  let component: AppUserList;
  let userService: jasmine.SpyObj<AppUserService>;
  let lookupService: jasmine.SpyObj<LookupService>;
  let confirmation: ConfirmationService;
  let messages: MessageService;

  beforeEach(async () => {
    sessionStorage.clear();
    userService = jasmine.createSpyObj<AppUserService>('AppUserService', ['query', 'delete']);
    lookupService = jasmine.createSpyObj<LookupService>('LookupService', ['getAppRoles']);
    userService.query.and.returnValue(of([HELEN, MILES]));
    userService.delete.and.returnValue(of(void 0));
    lookupService.getAppRoles.and.returnValue(of(APP_ROLES));

    await TestBed.configureTestingModule({
      imports: [AppUserList],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        ConfirmationService,
        { provide: AppUserService, useValue: userService },
        { provide: LookupService, useValue: lookupService },
      ],
    }).compileComponents();

    confirmation = TestBed.inject(ConfirmationService);
    messages = TestBed.inject(MessageService);
  });

  afterEach(() => sessionStorage.clear());

  function create(): void {
    fixture = TestBed.createComponent(AppUserList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function rows(): HTMLTableRowElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('tbody tr'));
  }

  it('loads lookups then queries with empty filters on init', () => {
    create();

    expect(lookupService.getAppRoles).toHaveBeenCalled();
    expect(userService.query).toHaveBeenCalledOnceWith({
      keyword: null,
      isActive: null,
      roleId: null,
    });
    expect(component.items().length).toBe(2);
  });

  it('renders a row per user, with UTC password time shown in local time', () => {
    create();

    const r = rows();
    expect(r.length).toBe(2);
    expect(r[0].textContent).toContain('helen');
    const local = new Date('2026-10-19T02:30:00Z');
    const hh = String(local.getHours()).padStart(2, '0');
    expect(r[0].textContent).toContain(`${hh}:30`);
    expect(r[1].textContent).toContain('Miles <Sun>');
    expect(r[1].textContent).toContain('—');
  });

  it('never renders a password field', () => {
    create();

    expect(fixture.nativeElement.textContent).not.toMatch(/hash/i);
  });

  it('shows the empty message when there are no results', () => {
    userService.query.and.returnValue(of([]));
    create();

    expect(fixture.nativeElement.textContent).toContain('查無資料');
  });

  it('maps roles to { pkid, label } options', () => {
    create();

    expect(component.roleOptions).toEqual([
      { pkid: 'Admin', label: 'Administrator (Admin)' },
      { pkid: 'User', label: 'User (User)' },
    ]);
  });

  it('search() sends trimmed filters, saves them to session storage and resets paging', () => {
    create();
    component.first = 40;
    component.filters = { keyword: '  hel ', isActive: false, roleId: 'Admin' };

    component.search();

    expect(userService.query).toHaveBeenCalledWith({
      keyword: 'hel',
      isActive: false,
      roleId: 'Admin',
    });
    expect(JSON.parse(sessionStorage.getItem(FILTERS_KEY)!).keyword).toBe('  hel ');
    expect(component.first).toBe(0);
    expect(component.activeFilterCount()).toBe(3);
  });

  it('restores filters, sort and page from session storage', () => {
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ keyword: 'mil', isActive: true }));
    sessionStorage.setItem(SORT_KEY, JSON.stringify({ sortField: 'userName', sortOrder: -1 }));
    sessionStorage.setItem(PAGE_KEY, JSON.stringify({ first: 10, rows: 10 }));

    create();

    expect(component.filters.keyword).toBe('mil');
    expect(component.filters.isActive).toBeTrue();
    expect(component.sortField).toBe('userName');
    expect(component.sortOrder).toBe(-1);
    expect(component.rows).toBe(10);
    expect(component.first).toBe(10);
    expect(userService.query).toHaveBeenCalledWith(
      jasmine.objectContaining({ keyword: 'mil', isActive: true }),
    );
  });

  it('clearFilters() resets filters and re-queries', () => {
    create();
    component.filters.keyword = 'x';
    userService.query.calls.reset();

    component.clearFilters();

    expect(component.filters.keyword).toBeNull();
    expect(component.activeFilterCount()).toBe(0);
    expect(userService.query).toHaveBeenCalledTimes(1);
  });

  it('persists sort and page changes', () => {
    create();

    component.onSort({ field: 'userName', order: -1 });
    component.onPage({ first: 20, rows: 20 });

    expect(JSON.parse(sessionStorage.getItem(SORT_KEY)!)).toEqual({
      sortField: 'userName',
      sortOrder: -1,
    });
    expect(JSON.parse(sessionStorage.getItem(PAGE_KEY)!)).toEqual({ first: 20, rows: 20 });
  });

  it('add() navigates to the new form', () => {
    create();
    const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    component.add();

    expect(nav).toHaveBeenCalledWith(['/app-users/new']);
  });

  it('confirmDelete() shows pkid and escaped name, deletes on accept and reloads', () => {
    create();
    spyOn(confirmation, 'confirm').and.callFake((c: Confirmation) => {
      expect(c.message).toContain('<b>3</b>');
      expect(c.message).toContain('Miles &#60;Sun&#62;');
      c.accept?.();
      return confirmation;
    });
    userService.query.calls.reset();

    component.confirmDelete(MILES);

    expect(userService.delete).toHaveBeenCalledOnceWith(3);
    expect(userService.query).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast when the query fails', () => {
    userService.query.and.returnValue(throwError(() => new Error('boom')));
    const add = spyOn(messages, 'add');

    create();

    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
    expect(component.loading()).toBeFalse();
  });
});

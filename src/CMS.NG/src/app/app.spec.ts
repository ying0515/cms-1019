import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { CurrentUser } from '@core/models/auth.model';
import { AuthService } from '@core/services/auth.service';
import { App } from './app';

describe('App', () => {
  let user: ReturnType<typeof signal<CurrentUser | null | undefined>>;
  let auth: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    user = signal<CurrentUser | null | undefined>({
      userId: 'helen',
      userName: 'Helen Wu',
      mustChangePassword: false,
      isAdmin: true,
    });
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['logout'], { user });
    auth.logout.and.returnValue(of(void 0));
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        ConfirmationService,
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('hides the sidebar when signed out or while a password change is forced', () => {
    const fixture = TestBed.createComponent(App);
    const el: HTMLElement = fixture.nativeElement;

    user.set(null);
    fixture.detectChanges();
    expect(el.querySelector('.sidebar')).toBeNull();

    user.set({ userId: 'helen', userName: 'Helen Wu', mustChangePassword: true, isAdmin: true });
    fixture.detectChanges();
    expect(el.querySelector('.sidebar')).toBeNull();
  });

  it('keeps the same router-outlet on sign-out, so the current page is not re-created', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const outlet = el.querySelector('router-outlet');

    user.set(null);
    fixture.detectChanges();

    expect(el.querySelectorAll('router-outlet').length).toBe(1);
    expect(el.querySelector('router-outlet')).toBe(outlet);
  });

  it('shows the signed-in user, 變更密碼 and 登出 in the sidebar', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const footer: HTMLElement = fixture.nativeElement.querySelector('[data-testid="sidebar-user"]');

    expect(footer.textContent).toContain('Helen Wu');
    expect(footer.querySelector('a')?.getAttribute('href')).toBe('/change-password');
  });

  it('登出 signs out and goes to /login', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.logout') as HTMLButtonElement).click();

    expect(auth.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('renders 上稿作業 FeaturedPromoItem under 首頁 Home as the first group', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('.nav-group')?.textContent).toContain('首頁 Home');
    const link = el.querySelectorAll('.nav-items')[0].querySelector('a');
    expect(link?.textContent).toContain('上稿作業 FeaturedPromoItem');
    expect(link?.getAttribute('href')).toBe('/featured-promo-items');
  });

  it('renders 使用者 AppUser then 角色 AppRole under 系統管理 Admin', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelectorAll('.nav-group')[1].textContent).toContain('系統管理 Admin');
    const links = el.querySelectorAll('.nav-items')[1].querySelectorAll('a');
    expect(links[0].textContent).toContain('使用者 AppUser');
    expect(links[0].getAttribute('href')).toBe('/app-users');
    expect(links[1].textContent).toContain('角色 AppRole');
    expect(links[1].getAttribute('href')).toBe('/app-roles');
  });

  it('renders the 課程管理 Course > 合作廠商 Partner / 課程群組 CourseGroup sidebar entries', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    const groups = Array.from(el.querySelectorAll('.nav-group')).map((g) => g.textContent);
    expect(groups[2]).toContain('課程管理 Course');
    const link = el.querySelector('.nav-items a[href="/partners"]');
    expect(link?.textContent).toContain('合作廠商 Partner');
    const groupLink = el.querySelector('.nav-items a[href="/course-groups"]');
    expect(groupLink?.textContent).toContain('課程群組 CourseGroup');
  });

  it('renders 課程 Course as the first 課程管理 Course entry', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    const courseItems = el.querySelectorAll('.nav-items')[2];
    const first = courseItems.querySelector('a');
    expect(first?.getAttribute('href')).toBe('/courses');
    expect(first?.textContent).toContain('課程 Course');
  });

  // Regression: ISSUE-004 — on a phone the expanded sidebar took ~60% of the width
  // Found by /qa on 2026-10-22
  // Report: .gstack/qa-reports/qa-report-localhost-2026-10-22.md
  it('starts with the sidebar collapsed on a narrow (≤768px) viewport', () => {
    spyOn(window, 'matchMedia').and.callFake((q: string) => ({ matches: q === '(max-width: 768px)' }) as MediaQueryList);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.layout')!.classList).toContain('collapsed');
  });

  it('starts with the sidebar expanded on a wide viewport', () => {
    spyOn(window, 'matchMedia').and.returnValue({ matches: false } as MediaQueryList);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.layout')!.classList).not.toContain('collapsed');
  });

  it('collapses a nav group when toggled', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const before = el.querySelectorAll('.nav-items').length;

    (el.querySelector('.nav-group') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelectorAll('.nav-items').length).toBe(before - 1);
    expect(el.querySelector('.nav-items a[href="/featured-promo-items"]')).toBeNull();
  });

  it('hides 使用者 / 角色 from a non-admin but keeps the rest of 系統管理 Admin', () => {
    user.set({ userId: 'miles', userName: 'Miles Sun', mustChangePassword: false, isAdmin: false });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('a[href="/app-users"]')).toBeNull();
    expect(el.querySelector('a[href="/app-roles"]')).toBeNull();
    expect(el.querySelector('a[href="/publish-statuses"]')).not.toBeNull();
    expect(el.querySelector('a[href="/courses"]')).not.toBeNull();
  });
});

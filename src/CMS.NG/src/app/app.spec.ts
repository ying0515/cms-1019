import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AUTH_PROFILE_KEY } from '@core/auth/auth.service';
import { signInForTest } from '@core/testing/auth';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    signInForTest(['Admin'], '海倫');
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideNoopAnimations(),
        MessageService,
        ConfirmationService,
      ],
    }).compileComponents();
  });

  afterEach(() => sessionStorage.clear());

  function groupLabels(el: HTMLElement): string[] {
    return Array.from(el.querySelectorAll('.nav-group')).map((g) => g.textContent?.trim() ?? '');
  }

  // ---- Auth ----

  it('shows 系統管理 Admin when the token roles include Admin', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(groupLabels(fixture.nativeElement)).toContain('系統管理 Admin');
  });

  it('hides 系統管理 Admin and its links for users without the Admin role', () => {
    signInForTest(['User']);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(groupLabels(el)).not.toContain('系統管理 Admin');
    expect(el.querySelector('a[href="/app-users"]')).toBeNull();
    expect(groupLabels(el)).toContain('課程管理 Course');
  });

  it('shows 系統管理 Admin when Admin is one of several roles', () => {
    signInForTest(['User', 'Admin']);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(groupLabels(fixture.nativeElement)).toContain('系統管理 Admin');
  });

  it('shows the signed-in UserName in the header', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('[data-testid="current-user"]')?.textContent).toContain('海倫');
  });

  it('has a 我的資料 link to /my-profile in the header', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const link = (fixture.nativeElement as HTMLElement).querySelector(
      '.topbar [data-testid="my-profile-link"]',
    );

    expect(link?.textContent).toContain('我的資料');
    expect(link?.getAttribute('href')).toBe('/my-profile');
  });

  it('登出 clears sessionStorage and goes to /login', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    (el.querySelector('[data-testid="logout"] button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(sessionStorage.getItem(AUTH_PROFILE_KEY)).toBeNull();
    expect(sessionStorage.length).toBe(0);
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: {} });
    expect(el.querySelector('.sidebar')).toBeNull();
  });

  it('renders no shell (sidebar / header) when signed out', () => {
    sessionStorage.clear();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('.sidebar')).toBeNull();
    expect(el.querySelector('.topbar')).toBeNull();
  });

  // ---- Sidebar ----

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
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

  it('renders 代理用量 Agent > 代理 Token 用量 as the last group', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    const groups = el.querySelectorAll('.nav-group');
    expect(groups[groups.length - 1].textContent).toContain('代理用量 Agent');
    const link = el.querySelector('.nav-items a[href="/agent-token-report"]');
    expect(link?.textContent).toContain('代理 Token 用量');
  });

  it('renders 模型價格 inside the 代理用量 Agent group', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    const groups = el.querySelectorAll('.nav-items');
    const link = groups[groups.length - 1].querySelector('a[href="/model-prices"]');
    expect(link?.textContent).toContain('模型價格 ModelPrice');
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
});

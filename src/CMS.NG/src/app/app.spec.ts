import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideNoopAnimations(), MessageService, ConfirmationService],
    }).compileComponents();
  });

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

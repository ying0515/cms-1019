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

  it('renders the 系統管理 Admin > 角色 AppRole sidebar entry', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('.nav-group')?.textContent).toContain('系統管理 Admin');
    const link = el.querySelector('.nav-items a');
    expect(link?.textContent).toContain('角色 AppRole');
    expect(link?.getAttribute('href')).toBe('/app-roles');
  });

  it('renders the 課程管理 Course > 合作廠商 Partner / 課程群組 CourseGroup sidebar entries', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    const groups = Array.from(el.querySelectorAll('.nav-group')).map((g) => g.textContent);
    expect(groups[1]).toContain('課程管理 Course');
    const link = el.querySelector('.nav-items a[href="/partners"]');
    expect(link?.textContent).toContain('合作廠商 Partner');
    const groupLink = el.querySelector('.nav-items a[href="/course-groups"]');
    expect(groupLink?.textContent).toContain('課程群組 CourseGroup');
  });

  it('renders 課程 Course as the first 課程管理 Course entry', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    const courseItems = el.querySelectorAll('.nav-items')[1];
    const first = courseItems.querySelector('a');
    expect(first?.getAttribute('href')).toBe('/courses');
    expect(first?.textContent).toContain('課程 Course');
  });

  it('collapses a nav group when toggled', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const before = el.querySelectorAll('.nav-items').length;

    (el.querySelector('.nav-group') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelectorAll('.nav-items').length).toBe(before - 1);
    expect(el.querySelector('.nav-items a[href="/app-roles"]')).toBeNull();
  });
});

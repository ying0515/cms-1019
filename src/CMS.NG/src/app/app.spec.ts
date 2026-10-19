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

  it('collapses a nav group when toggled', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.nav-group') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.nav-items')).toBeNull();
  });
});

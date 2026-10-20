import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';

import { AUTH_PROFILE_KEY, CHANGE_PASSWORD_URL, PROFILE_URL } from '@core/auth/auth.service';
import {
  PASSWORD_POLICY_MESSAGE_EN,
  PASSWORD_POLICY_MESSAGE_ZH,
} from '@core/utils/password-policy';
import { signInForTest } from '@core/testing/auth';
import { expectPinnedToolbar } from '@core/testing/form-toolbar';
import { App } from '../../app';
import { MyProfile } from './my-profile';

describe('MyProfile', () => {
  let http: HttpTestingController;
  let messages: MessageService;

  beforeEach(() => {
    sessionStorage.clear();
    signInForTest(['Admin', 'User'], '海倫');
    TestBed.configureTestingModule({
      imports: [MyProfile, App],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        MessageService,
        ConfirmationService,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    messages = TestBed.inject(MessageService);
    spyOn(messages, 'add');
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  function create() {
    const fixture = TestBed.createComponent(MyProfile);
    fixture.detectChanges();
    return fixture;
  }

  function typeName(el: HTMLElement, value: string): void {
    const input = el.querySelector('#userName') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function submit(el: HTMLElement): void {
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
  }

  it('shows UserId and roles as read-only text, and UserName as the only input', () => {
    const el: HTMLElement = create().nativeElement;

    expect(el.querySelector('[data-testid="profile-user-id"]')?.textContent?.trim()).toBe('helen');
    const roles = Array.from(el.querySelectorAll('[data-testid="profile-roles"] .p-tag-label'));
    expect(roles.map((r) => r.textContent?.trim())).toEqual(['Admin', 'User']);

    // profile form only (the 變更密碼 form below has its own password inputs)
    const profileForm = el.querySelector('form:not([data-testid="password-form"])')!;
    const inputs = Array.from(
      profileForm.querySelectorAll('input, select, textarea, p-select, p-multiselect'),
    );
    expect(inputs.map((i) => i.id)).toEqual(['userName']);
    expect((el.querySelector('#userName') as HTMLInputElement).value).toBe('海倫');
  });

  it('has the pinned Save/Cancel toolbar', () => {
    expectPinnedToolbar(create().nativeElement);
  });

  it('saves the trimmed UserName only (no UserId or roles in the body)', () => {
    const fixture = create();
    const el: HTMLElement = fixture.nativeElement;

    typeName(el, '  海倫 Chen  ');
    submit(el);

    const req = http.expectOne(PROFILE_URL);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ userName: '海倫 Chen' });
    req.flush({ userId: 'helen', userName: '海倫 Chen' });

    expect(JSON.parse(sessionStorage.getItem(AUTH_PROFILE_KEY)!).userName).toBe('海倫 Chen');
    expect(messages.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'success' }));
  });

  it('saving refreshes the UserName in the app shell header', () => {
    const shell = TestBed.createComponent(App);
    shell.detectChanges();
    const header = () => shell.nativeElement.querySelector('[data-testid="current-user"]');
    expect(header().textContent).toContain('海倫');

    const page = create();
    typeName(page.nativeElement, '新名字');
    submit(page.nativeElement);
    http.expectOne(PROFILE_URL).flush({ userId: 'helen', userName: '新名字' });
    shell.detectChanges();

    expect(header().textContent).toContain('新名字');
    expect(header().textContent).not.toContain('海倫');
  });

  for (const blank of ['', '   ']) {
    it(`does not send an empty/whitespace UserName (${JSON.stringify(blank)})`, () => {
      const fixture = create();
      const el: HTMLElement = fixture.nativeElement;

      typeName(el, blank);
      submit(el);
      fixture.detectChanges();

      http.expectNone(PROFILE_URL);
      expect(el.textContent).toContain('請輸入使用者名稱');
    });
  }

  it('on an API error keeps the stored name and shows a toast', () => {
    const fixture = create();
    const el: HTMLElement = fixture.nativeElement;

    typeName(el, 'X');
    submit(el);
    http
      .expectOne(PROFILE_URL)
      .flush(
        { errors: { UserName: ['請輸入使用者名稱'] } },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(JSON.parse(sessionStorage.getItem(AUTH_PROFILE_KEY)!).userName).toBe('海倫');
    expect(messages.add).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'error', detail: '請輸入使用者名稱' }),
    );
  });

  it('取消 puts back the saved name', () => {
    const fixture = create();
    const el: HTMLElement = fixture.nativeElement;

    typeName(el, 'changed');
    fixture.componentInstance.cancel();
    fixture.detectChanges();

    expect((el.querySelector('#userName') as HTMLInputElement).value).toBe('海倫');
  });

  describe('變更密碼', () => {
    function type(el: HTMLElement, id: string, value: string): void {
      const input = el.querySelector(`#${id}`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('blur'));
    }

    function fillPasswords(el: HTMLElement, current: string, next: string, confirm: string) {
      type(el, 'currentPassword', current);
      type(el, 'newPassword', next);
      type(el, 'confirmPassword', confirm);
    }

    function submitPasswords(fixture: ReturnType<typeof create>): HTMLElement {
      const el: HTMLElement = fixture.nativeElement;
      el.querySelector('[data-testid="password-form"]')!.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
      return el;
    }

    const policy = (el: HTMLElement) =>
      el.querySelector('[data-testid="password-policy"]') as HTMLElement;

    it('has password-type inputs and shows the bilingual rule as a hint', () => {
      const el: HTMLElement = create().nativeElement;

      for (const id of ['currentPassword', 'newPassword', 'confirmPassword']) {
        expect((el.querySelector(`#${id}`) as HTMLInputElement).type).toBe('password');
      }
      expect(policy(el).textContent).toContain(PASSWORD_POLICY_MESSAGE_ZH);
      expect(policy(el).textContent).toContain(PASSWORD_POLICY_MESSAGE_EN);
      expect(policy(el).classList).not.toContain('error');
    });

    it('requires all three fields and sends nothing', () => {
      const el = submitPasswords(create());

      http.expectNone(CHANGE_PASSWORD_URL);
      expect(el.textContent).toContain('請輸入目前密碼');
      expect(el.textContent).toContain('請輸入新密碼');
      expect(el.textContent).toContain('請再次輸入新密碼');
    });

    for (const weak of ['Ab1!xyz', 'abcdefgh', 'abcd1234', 'ABCDabcd']) {
      it(`flags a weak new password (${weak}) with the bilingual rule and sends nothing`, () => {
        const fixture = create();
        fillPasswords(fixture.nativeElement, 'Old#Pass1', weak, weak);
        const el = submitPasswords(fixture);

        http.expectNone(CHANGE_PASSWORD_URL);
        expect(policy(el).classList).toContain('error');
        expect(policy(el).textContent).toContain('密碼長度至少需 8 碼');
        expect(policy(el).textContent).toContain('Password must be at least 8 characters');
      });
    }

    it('flags new / confirm mismatch and sends nothing', () => {
      const fixture = create();
      fillPasswords(fixture.nativeElement, 'Old#Pass1', 'N3w-Secret!', 'N3w-Secret?');
      const el = submitPasswords(fixture);

      http.expectNone(CHANGE_PASSWORD_URL);
      expect(el.querySelector('[data-testid="password-mismatch"]')?.textContent).toContain(
        '新密碼與確認密碼不一致',
      );
      expect(policy(el).classList).not.toContain('error');
    });

    it('posts the three passwords when valid, then clears the form', () => {
      const fixture = create();
      fillPasswords(fixture.nativeElement, 'Old#Pass1', 'N3w-Secret!', 'N3w-Secret!');
      const el = submitPasswords(fixture);

      const req = http.expectOne(CHANGE_PASSWORD_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        currentPassword: 'Old#Pass1',
        newPassword: 'N3w-Secret!',
        confirmPassword: 'N3w-Secret!',
      });
      req.flush(null, { status: 204, statusText: 'No Content' });
      fixture.detectChanges();

      expect((el.querySelector('#newPassword') as HTMLInputElement).value).toBe('');
      expect(messages.add).toHaveBeenCalledWith(
        jasmine.objectContaining({ severity: 'success', summary: '密碼已變更' }),
      );
    });

    it('shows the API message (e.g. wrong current password) and keeps the session', () => {
      const fixture = create();
      fillPasswords(fixture.nativeElement, 'wrong', 'N3w-Secret!', 'N3w-Secret!');
      const el = submitPasswords(fixture);

      http
        .expectOne(CHANGE_PASSWORD_URL)
        .flush({ message: '目前密碼不正確' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();

      expect(el.querySelector('[data-testid="password-error"]')?.textContent).toContain(
        '目前密碼不正確',
      );
      expect(sessionStorage.getItem(AUTH_PROFILE_KEY)).not.toBeNull();
    });
  });
});

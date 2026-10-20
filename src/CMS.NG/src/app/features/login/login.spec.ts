import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';

import { AUTH_PROFILE_KEY, LOGIN_URL } from '@core/auth/auth.service';
import { fakeToken } from '@core/testing/auth';
import { Login } from './login';

describe('Login', () => {
  let http: HttpTestingController;
  let router: Router;

  function create(returnUrl: string | null = null) {
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    return fixture;
  }

  function fill(el: HTMLElement, userId: string, password: string): void {
    const id = el.querySelector('#userId') as HTMLInputElement;
    const pw = el.querySelector('#password') as HTMLInputElement;
    id.value = userId;
    id.dispatchEvent(new Event('input'));
    pw.value = password;
    pw.dispatchEvent(new Event('input'));
  }

  function submit(el: HTMLElement): void {
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
  }

  beforeEach(() => sessionStorage.clear());
  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('posts { userId, password }, stores the profile in sessionStorage and goes to returnUrl', () => {
    const fixture = create('/courses?page=2');
    const el: HTMLElement = fixture.nativeElement;
    const profile = { userId: 'helen', userName: '海倫', accessToken: fakeToken() };

    fill(el, 'helen', 'Secret#123');
    submit(el);
    const req = http.expectOne(LOGIN_URL);
    expect(req.request.body).toEqual({ userId: 'helen', password: 'Secret#123' });
    req.flush(profile);

    expect(JSON.parse(sessionStorage.getItem(AUTH_PROFILE_KEY)!)).toEqual(profile);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/courses?page=2');
  });

  it('goes to / without a returnUrl, and ignores off-site returnUrls', () => {
    const fixture = create('//evil.example.com');
    const el: HTMLElement = fixture.nativeElement;

    fill(el, 'helen', 'pw');
    submit(el);
    http
      .expectOne(LOGIN_URL)
      .flush({ userId: 'helen', userName: 'helen', accessToken: fakeToken() });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('shows the API message on 401 and stays on the page', () => {
    const fixture = create();
    const el: HTMLElement = fixture.nativeElement;

    fill(el, 'helen', 'wrong');
    submit(el);
    http
      .expectOne(LOGIN_URL)
      .flush({ message: '帳號或密碼錯誤' }, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="login-error"]')?.textContent).toContain(
      '帳號或密碼錯誤',
    );
    expect(sessionStorage.getItem(AUTH_PROFILE_KEY)).toBeNull();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('requires both fields before posting', () => {
    const fixture = create();
    const el: HTMLElement = fixture.nativeElement;

    submit(el);
    fixture.detectChanges();

    http.expectNone(LOGIN_URL);
    expect(el.textContent).toContain('請輸入帳號');
    expect(el.textContent).toContain('請輸入密碼');
  });
});

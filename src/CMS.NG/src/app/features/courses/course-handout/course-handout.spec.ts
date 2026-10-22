import { TestBed } from '@angular/core/testing';

import { Course } from '@core/models/course.model';
import {
  CONTENT_FIELDS,
  HANDOUT_CONTENT_KEYS,
  HANDOUT_EXCLUDED_KEYS,
} from '../course-content-fields';
import { AZ104, CCNA, PUBLISH_STATUSES } from '../testing/course.fixtures';
import { CourseHandout } from './course-handout';

describe('CourseHandout', () => {
  // Fixed clock: whether the QR prints depends on today versus the fixtures' schedules.
  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 9, 21, 12));
  });
  afterEach(() => jasmine.clock().uninstall());

  function render(course: Course): HTMLElement {
    TestBed.configureTestingModule({ imports: [CourseHandout] });
    const fixture = TestBed.createComponent(CourseHandout);
    fixture.componentRef.setInput('course', course);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  /** The handout's own text, without the QR code (its URL legitimately carries the pkid). */
  function ownText(el: HTMLElement): string {
    const copy = el.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('app-course-qr-code').forEach((qr) => qr.remove());
    return copy.textContent ?? '';
  }

  const ALL_CONTENT: Course = {
    ...AZ104,
    material: '官方教材',
    objective: '管理 Azure 訂用帳戶',
    target: 'IT 管理人員',
    prerequisites: '具備網路基礎',
    outline: '第一章\n第二章',
    towardCertOrExam: 'AZ-104 考試',
    note: '自備筆電',
    otherInfo: '提供午餐',
  };

  it('renders title, official title, course id, hours, partner and the QR code', () => {
    const el = render(AZ104);

    expect(el.querySelector('.handout-title')?.textContent).toBe('Microsoft Azure 管理員');
    expect(el.querySelector('.handout-official-title')?.textContent).toBe(
      'Microsoft Azure Administrator',
    );
    expect(el.querySelector('.handout-meta')?.textContent).toBe('簡介代碼 AZ-104｜時數 32 小時');
    expect(el.querySelector('.handout-partner')?.textContent).toBe('原廠 Microsoft');
    expect(el.querySelector('app-course-qr-code canvas')?.getAttribute('aria-label')).toBe(
      'QR Code：AZ-104',
    );
  });

  it('omits the official title and partner lines when they are null', () => {
    const el = render({ ...CCNA, partner: null });

    expect(el.querySelector('.handout-official-title')).toBeNull();
    expect(el.querySelector('.handout-partner')).toBeNull();
    expect(ownText(el)).not.toContain('原廠');
  });

  it('omits hours when not positive and trims the course id', () => {
    const el = render({ ...AZ104, courseId: ' AZ-104  ', hour: 0 });

    expect(el.querySelector('.handout-meta')?.textContent).toBe('簡介代碼 AZ-104');
  });

  it('leaves out a blank course id and prints the fallback line instead of the QR', () => {
    const el = render({ ...AZ104, courseId: '  ' });

    expect(el.querySelector('.handout-meta')?.textContent).toBe('時數 32 小時');
    expect(el.querySelector('app-course-qr-code')).toBeNull();
    expect(el.querySelector('.handout-offline')).not.toBeNull();
  });

  it('omits the meta line when there is neither a course id nor hours', () => {
    const el = render({ ...AZ104, courseId: '', hour: 0 });

    expect(el.querySelector('.handout-meta')).toBeNull();
  });

  it('re-checks the schedule against today right before printing', () => {
    const el = render({ ...AZ104, scheduleOn: '2026-10-22' });
    expect(el.querySelector('app-course-qr-code')).toBeNull();

    jasmine.clock().mockDate(new Date(2026, 9, 22, 9)); // tab left open overnight
    window.dispatchEvent(new Event('beforeprint'));

    expect(el.querySelector('app-course-qr-code')).not.toBeNull();
  });

  it('prints the QR without its URL caption, with its own scan caption', () => {
    const el = render(AZ104);

    expect(el.querySelector('app-course-qr-code figcaption')).toBeNull();
    expect(el.querySelector('.handout-qr-caption')?.textContent).toBe('掃描查看課程網頁');
  });

  for (const [why, course] of [
    ['a draft status', { ...AZ104, publishStatus: PUBLISH_STATUSES[0] }],
    ['a past schedule', { ...AZ104, scheduleOn: '2020-01-01', scheduleOff: '2021-01-01' }],
    ['a future schedule', { ...AZ104, scheduleOn: '2099-01-01', scheduleOff: '2100-01-01' }],
  ] as const) {
    it(`prints a fallback line instead of the QR for ${why}`, () => {
      const el = render(course);

      expect(el.querySelector('app-course-qr-code')).toBeNull();
      expect(el.querySelector('.handout-offline')?.textContent).toBe(
        '課程網頁上架後，可至 uuu.com.tw 查詢本課程',
      );
    });
  }

  it('prints the content fields in reading order, with labels and line breaks', () => {
    const el = render(ALL_CONTENT);

    const fields = [...el.querySelectorAll('.handout-section[data-field]')];
    expect(fields.map((s) => s.getAttribute('data-field'))).toEqual([
      'objective',
      'target',
      'prerequisites',
      'outline',
      'towardCertOrExam',
      'material',
      'note',
      'otherInfo',
    ]);
    expect(el.querySelector('[data-field="outline"] h2')?.textContent).toBe('課程大綱');
    expect(el.querySelector('[data-field="outline"] .handout-text')?.textContent).toBe(
      '第一章\n第二章',
    );
  });

  it('classifies every content field as printed or excluded, exactly once', () => {
    const classified = [...HANDOUT_CONTENT_KEYS, ...HANDOUT_EXCLUDED_KEYS];

    expect([...classified].sort()).toEqual(CONTENT_FIELDS.map((f) => f.key).sort());
    expect(new Set(classified).size).toBe(classified.length);
  });

  it('skips content sections that are null or blank', () => {
    const el = render({ ...AZ104, material: '   ', note: '' });

    const fields = [...el.querySelectorAll('.handout-section[data-field]')];
    expect(fields.map((s) => s.getAttribute('data-field'))).toEqual(['objective']);
  });

  it('never prints back-office fields', () => {
    const text = ownText(render(ALL_CONTENT));

    for (const label of [
      '主代碼',
      '友善網址',
      '顯示順序',
      '上架狀態',
      '上架日期',
      '下架日期',
      '定價',
      '點數',
    ]) {
      expect(text).withContext(label).not.toContain(label);
    }
    expect(text).not.toContain('az-104'); // friendlyUrl
    expect(text).not.toContain('28,000'); // listPrice
    expect(text).not.toContain('28000');
    expect(text).not.toContain('已發布'); // publishStatus
    expect(text).not.toContain('2036-01-01'); // scheduleOff
  });

  it('lists certifications, without a trailing dash when the title is null', () => {
    const el = render({
      ...AZ104,
      certifications: [
        AZ104.certifications[0],
        { pkid: 9, title: null, partnerPkid: 2, partnerName: 'Cisco' },
      ],
    });

    const items = [...el.querySelectorAll('.handout-certifications li')].map(
      (li) => li.textContent,
    );
    expect(items).toEqual(['Microsoft - Azure Administrator Associate', 'Cisco']);
  });

  it('omits the certifications section when there are none', () => {
    const el = render(CCNA);

    expect(el.querySelector('.handout-certifications')).toBeNull();
  });
});

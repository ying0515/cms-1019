import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { RowAuditEntry } from '@core/models/row-audit.model';
import { RowAuditService } from '@core/services/row-audit.service';
import { formatApiDateTime } from '@core/utils/date.util';
import { RowAuditBadgeComponent } from './row-audit-badge';

const HISTORY: RowAuditEntry[] = [
  {
    dateTime: '2026-06-04T06:30:00',
    userName: 'alice',
    actionType: 'Update',
    actionDesc: 'Title,Hour',
  },
  { dateTime: '2026-06-02T01:00:00', userName: 'bob', actionType: 'Update', actionDesc: 'Note' },
  {
    dateTime: '2026-06-01T00:15:00',
    userName: '海倫',
    actionType: 'Insert',
    actionDesc: '雲端課程',
  },
];

describe('RowAuditBadgeComponent', () => {
  let service: jasmine.SpyObj<RowAuditService>;

  async function setup(history: RowAuditEntry[] | 'error' = HISTORY) {
    service = jasmine.createSpyObj<RowAuditService>('RowAuditService', ['getHistory']);
    service.getHistory.and.returnValue(
      history === 'error' ? throwError(() => new HttpErrorResponse({ status: 500 })) : of(history),
    );

    await TestBed.configureTestingModule({
      imports: [RowAuditBadgeComponent],
      providers: [provideNoopAnimations(), { provide: RowAuditService, useValue: service }],
    }).compileComponents();

    const fixture = TestBed.createComponent(RowAuditBadgeComponent);
    fixture.componentRef.setInput('tableName', 'Course');
    fixture.componentRef.setInput('pkid', 7);
    fixture.detectChanges();
    return fixture;
  }

  const badge = (el: HTMLElement) =>
    el.querySelector<HTMLButtonElement>('[data-testid="row-audit-badge"]')!;
  const latest = (el: HTMLElement) =>
    el.querySelector('[data-testid="row-audit-latest"]')!.textContent!;
  // The dialog is appended to <body>
  const dialog = () => document.body.querySelector('[data-testid="row-audit-dialog"]');

  async function openDialog(fixture: Awaited<ReturnType<typeof setup>>) {
    badge(fixture.nativeElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => {
    // Close any open dialog so it does not leak into the next test's <body>
    document.body.querySelectorAll('.p-dialog-mask').forEach((m) => m.remove());
  });

  it('fetches the history of its record on load', async () => {
    await setup();

    expect(service.getHistory).toHaveBeenCalledOnceWith('Course', 7);
  });

  it('shows the bilingual label and the latest change inline', async () => {
    const el: HTMLElement = (await setup()).nativeElement;

    expect(badge(el).textContent).toContain('異動紀錄 History');
    const text = latest(el);
    expect(text).toContain('修改');
    expect(text).toContain('alice');
    expect(text).toContain(formatApiDateTime('2026-06-04T06:30:00'));
    expect(text).not.toContain('bob');
  });

  it('shows the neutral no-history state when the record has no history', async () => {
    const el: HTMLElement = (await setup([])).nativeElement;

    expect(latest(el)).toContain('尚無紀錄 No history');
  });

  it('does not render the dialog until the badge is clicked', async () => {
    await setup();

    expect(dialog()).toBeNull();
  });

  it('opens a dialog with the full trail, newest first', async () => {
    const fixture = await setup();

    await openDialog(fixture);

    const rows = Array.from(document.body.querySelectorAll('[data-testid="row-audit-row"]'));
    expect(rows.length).toBe(3);
    const cells = rows.map((r) =>
      Array.from(r.querySelectorAll('td'), (td) => td.textContent!.trim()),
    );
    expect(cells[0]).toEqual([
      formatApiDateTime('2026-06-04T06:30:00'),
      'alice',
      jasmine.stringMatching(/修改\s*Update/),
      'Title, Hour',
    ]);
    expect(cells.map((c) => c[1])).toEqual(['alice', 'bob', '海倫']);
    expect(cells[2][2]).toMatch(/新增\s*Insert/);
    expect(cells[2][3]).toBe('雲端課程');
    expect(service.getHistory).toHaveBeenCalledTimes(1);
  });

  it('shows the friendly empty state in the dialog when there is no history', async () => {
    const fixture = await setup([]);

    await openDialog(fixture);

    expect(dialog()!.querySelector('[data-testid="row-audit-empty"]')?.textContent).toContain(
      '尚無異動紀錄 No history yet',
    );
    expect(document.body.querySelector('[data-testid="row-audit-row"]')).toBeNull();
  });

  it('shows an unavailable state when the history cannot be loaded', async () => {
    const fixture = await setup('error');

    expect(latest(fixture.nativeElement)).toContain('無法載入');
    await openDialog(fixture);
    expect(dialog()!.textContent).toContain('無法載入異動紀錄');
  });

  it('is a non-submit button, so it is safe inside a form toolbar', async () => {
    const el: HTMLElement = (await setup()).nativeElement;

    expect(badge(el).type).toBe('button');
  });

  it('reloads when given another record', async () => {
    const fixture = await setup();

    fixture.componentRef.setInput('pkid', 8);
    fixture.detectChanges();

    expect(service.getHistory).toHaveBeenCalledWith('Course', 8);
  });
});

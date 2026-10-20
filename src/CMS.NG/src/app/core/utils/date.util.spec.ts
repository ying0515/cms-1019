import { addDays, addYears, parseIsoDate, startOfWeek, toIsoDate } from './date.util';

describe('date.util', () => {
  it('addDays() crosses month and year boundaries', () => {
    expect(toIsoDate(addDays(new Date(2026, 2, 30), 3))).toBe('2026-04-02');
    expect(toIsoDate(addDays(new Date(2026, 0, 2), -7))).toBe('2025-12-26');
  });

  it('startOfWeek() returns the Monday of the week (Monday–Sunday)', () => {
    expect(toIsoDate(startOfWeek(new Date(2026, 2, 16)))).toBe('2026-03-16'); // Monday
    expect(toIsoDate(startOfWeek(new Date(2026, 2, 18)))).toBe('2026-03-16'); // Wednesday
    expect(toIsoDate(startOfWeek(new Date(2026, 2, 22)))).toBe('2026-03-16'); // Sunday
    expect(toIsoDate(startOfWeek(new Date(2026, 0, 1)))).toBe('2025-12-29'); // across a year
  });

  it('startOfWeek() drops the time part', () => {
    expect(startOfWeek(new Date(2026, 2, 18, 23, 59)).getHours()).toBe(0);
  });

  it('toIsoDate() uses local date components', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    // Local midnight would be the previous day in UTC for UTC+ time zones
    expect(toIsoDate(new Date(2026, 9, 19, 0, 0, 0))).toBe('2026-10-19');
  });

  it('parseIsoDate() returns a local midnight Date', () => {
    const d = parseIsoDate('2026-03-01')!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
  });

  it('parseIsoDate() accepts a datetime string and rejects junk', () => {
    expect(toIsoDate(parseIsoDate('2026-03-01T00:00:00')!)).toBe('2026-03-01');
    expect(parseIsoDate(null)).toBeNull();
    expect(parseIsoDate('')).toBeNull();
    expect(parseIsoDate('03/01/2026')).toBeNull();
  });

  it('round-trips through toIsoDate()', () => {
    expect(toIsoDate(parseIsoDate('2030-12-31')!)).toBe('2030-12-31');
  });

  it('addYears() adds whole years', () => {
    expect(toIsoDate(addYears(new Date(2026, 9, 19), 10))).toBe('2036-10-19');
  });

  it('addYears() maps Feb 29 to Feb 28 in a non-leap year', () => {
    expect(toIsoDate(addYears(new Date(2028, 1, 29), 1))).toBe('2029-02-28');
    expect(toIsoDate(addYears(new Date(2028, 1, 29), 4))).toBe('2032-02-29');
  });
});

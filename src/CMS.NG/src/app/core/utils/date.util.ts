/**
 * Date helpers for API `date` columns ('yyyy-MM-dd').
 * Always use local date components — never `toISOString().split('T')[0]`, which shifts to UTC
 * and is off by one day for UTC+8 users.
 */

/** Local Date → 'yyyy-MM-dd'. */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 'yyyy-MM-dd' (optionally followed by a time part) → local Date at midnight; null when invalid. */
export function parseIsoDate(s: string | null | undefined): Date | null {
  const m = s ? /^(\d{4})-(\d{2})-(\d{2})/.exec(s) : null;
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * API UTC datetime ('2026-06-04T06:30:00', no zone suffix) → local 'yyyy-MM-dd HH:mm'; '' when invalid.
 * Appends 'Z' so the browser does not read it as local time.
 */
export function formatApiDateTime(s: string | null | undefined): string {
  if (!s) return '';
  const d = new Date(/(?:[zZ]|[+-]\d{2}:\d{2})$/.test(s) ? s : `${s}Z`);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${toIsoDate(d)} ${hh}:${mm}`;
}

/** Adds whole years; Feb 29 falls back to Feb 28 in non-leap years. */
export function addYears(d: Date, years: number): Date {
  const result = new Date(d.getFullYear() + years, d.getMonth(), d.getDate());
  if (result.getMonth() !== d.getMonth()) result.setDate(0);
  return result;
}

/** Adds whole days (negative to subtract). */
export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/** Monday (local midnight) of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  return addDays(d, -((d.getDay() + 6) % 7));
}

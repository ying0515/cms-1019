import { HttpErrorResponse } from '@angular/common/http';

/** Extracts a user-facing message from an API error response. */
export function httpErrorMessage(err: unknown, fallback = '發生錯誤，請稍後再試'): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return '無法連線至伺服器';
    const body = err.error;
    if (body && typeof body === 'object') {
      if (typeof body.message === 'string') return body.message;
      if (body.errors && typeof body.errors === 'object') {
        const first = Object.values(body.errors as Record<string, string[]>)[0];
        if (Array.isArray(first) && first.length) return first[0];
      }
      if (typeof body.title === 'string') return body.title;
    }
    if (err.status === 404) return '找不到資料';
  }
  return fallback;
}

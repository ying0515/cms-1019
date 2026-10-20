import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';

/** 5xx: the API's generic "unexpected error". `authInterceptor` already toasts these. */
export function isServerError(err: unknown): err is HttpErrorResponse {
  return err instanceof HttpErrorResponse && err.status >= 500;
}

/**
 * Page-level error toast: `summary` says what failed (載入失敗, 儲存失敗, …), the detail comes from the API.
 * Skips 5xx, which `authInterceptor` has already shown, so the user never gets two toasts for one failure.
 */
export function showHttpError(messages: MessageService, summary: string, err: unknown): void {
  if (isServerError(err)) return;
  messages.add({ severity: 'error', summary, detail: httpErrorMessage(err) });
}

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

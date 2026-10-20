import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';

import { httpErrorMessage, isServerError, showHttpError } from './http-error.util';

describe('http-error.util', () => {
  const error = (status: number, body: unknown = null) =>
    new HttpErrorResponse({ status, error: body });

  it('isServerError() is true for 5xx only', () => {
    expect(isServerError(error(500))).toBeTrue();
    expect(isServerError(error(503))).toBeTrue();
    expect(isServerError(error(409))).toBeFalse();
    expect(isServerError(error(0))).toBeFalse();
    expect(isServerError(new Error('x'))).toBeFalse();
  });

  describe('showHttpError()', () => {
    let messages: jasmine.SpyObj<MessageService>;
    beforeEach(() => (messages = jasmine.createSpyObj<MessageService>('MessageService', ['add'])));

    it('toasts 4xx with the page summary and the API message', () => {
      showHttpError(messages, '刪除失敗', error(409, { message: '已被使用，無法刪除' }));

      expect(messages.add).toHaveBeenCalledOnceWith({
        severity: 'error',
        summary: '刪除失敗',
        detail: '已被使用，無法刪除',
      });
    });

    it('toasts a lost connection (status 0)', () => {
      showHttpError(messages, '載入失敗', error(0));

      expect(messages.add).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ detail: '無法連線至伺服器' }),
      );
    });

    it('skips 5xx, which the interceptor already toasted', () => {
      showHttpError(messages, '儲存失敗', error(500, { message: 'An unexpected error occurred.' }));

      expect(messages.add).not.toHaveBeenCalled();
    });
  });

  it('httpErrorMessage() reads the safe message of a 500 body', () => {
    expect(httpErrorMessage(error(500, { message: 'safe', traceId: 't' }))).toBe('safe');
  });
});

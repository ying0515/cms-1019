import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { catchError, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { httpErrorMessage, isServerError } from '../utils/http-error.util';
import { AuthService, LOGIN_URL } from './auth.service';

export const SERVER_ERROR_SUMMARY = '系統錯誤 Server error';

/**
 * Adds `Authorization: Bearer <token>` to CMS.API requests (never to other hosts).
 * A 401 from the API ends the session: sessionStorage is cleared and the user goes to /login.
 * The login call's own 401 means bad credentials, so the login page handles it.
 * A 5xx shows one error toast with the API's safe message; pages skip 5xx in `showHttpError()`.
 * Every error is still rethrown, so callers can reset their loading / saving state.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const messages = inject(MessageService);
  if (!req.url.startsWith(environment.apiUrl)) return next(req);

  const token = auth.token;
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && req.url !== LOGIN_URL) {
        auth.logout(router.url);
      } else if (isServerError(err)) {
        messages.add({
          severity: 'error',
          summary: SERVER_ERROR_SUMMARY,
          detail: httpErrorMessage(err),
        });
      }
      return throwError(() => err);
    }),
  );
};

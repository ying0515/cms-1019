import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { AuthService, LOGIN_URL } from './auth.service';

/**
 * Adds `Authorization: Bearer <token>` to CMS.API requests (never to other hosts).
 * A 401 from the API ends the session: sessionStorage is cleared and the user goes to /login.
 * The login call's own 401 means bad credentials, so the login page handles it.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!req.url.startsWith(environment.apiUrl)) return next(req);

  const token = auth.token;
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && req.url !== LOGIN_URL) {
        auth.logout(router.url);
      }
      return throwError(() => err);
    }),
  );
};

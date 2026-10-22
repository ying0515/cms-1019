import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { AuthService } from '@core/services/auth.service';

const authUrl = `${environment.apiUrl}/api/auth/`;

/** Sends the session cookie to the API; a 401 elsewhere means the session ended, so go to login. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) return next(req);

  const auth = inject(AuthService);
  const router = inject(Router);
  return next(req.clone({ withCredentials: true })).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && !req.url.startsWith(authUrl)) {
        auth.sessionEnded();
        if (!router.url.startsWith('/login'))
          void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
      }
      return throwError(() => err);
    }),
  );
};

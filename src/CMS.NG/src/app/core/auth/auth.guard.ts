import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '@core/services/auth.service';

/** Back-office pages: signed in, and not holding a default password. */
export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  return inject(AuthService)
    .ensureLoaded()
    .pipe(
      map((user) => {
        if (!user)
          return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
        if (user.mustChangePassword) return router.createUrlTree(['/change-password']);
        return true;
      }),
    );
};

/** /change-password: any signed-in user. */
export const signedInGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService)
    .ensureLoaded()
    .pipe(map((user) => (user ? true : router.createUrlTree(['/login']))));
};

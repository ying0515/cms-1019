import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { ChangePasswordRequest, CurrentUser, LoginRequest } from '../models/auth.model';

/** Cookie session (HttpOnly, set by the API). `user()`: undefined = not checked yet, null = signed out. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/auth`;

  readonly user = signal<CurrentUser | null | undefined>(undefined);

  /** Loads the session once; later calls reuse `user()`. */
  ensureLoaded(): Observable<CurrentUser | null> {
    const known = this.user();
    if (known !== undefined) return of(known);
    return this.http.get<CurrentUser>(`${this.baseUrl}/me`).pipe(
      catchError((err: unknown) =>
        err instanceof HttpErrorResponse && err.status === 401 ? of(null) : throwError(() => err),
      ),
      tap((user) => this.user.set(user)),
    );
  }

  login(request: LoginRequest): Observable<CurrentUser> {
    return this.http
      .post<CurrentUser>(`${this.baseUrl}/login`, request)
      .pipe(tap((user) => this.user.set(user)));
  }

  changePassword(request: ChangePasswordRequest): Observable<CurrentUser> {
    return this.http
      .post<CurrentUser>(`${this.baseUrl}/change-password`, request)
      .pipe(tap((user) => this.user.set(user)));
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/logout`, null).pipe(
      catchError(() => of(undefined)),
      map(() => this.user.set(null)),
    );
  }

  /** The API answered 401: the session ended (expired, logged out elsewhere, password reset). */
  sessionEnded(): void {
    this.user.set(null);
  }
}

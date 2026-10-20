import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '@env/environment';
import {
  ChangePasswordRequest,
  LoginRequest,
  ProfileResponse,
  UserProfile,
} from '../models/auth.model';
import { loadSession, saveSession } from '../utils/session-state.util';

export const AUTH_PROFILE_KEY = 'auth-profile';
export const LOGIN_URL = `${environment.apiUrl}/api/auth/login`;
export const PROFILE_URL = `${environment.apiUrl}/api/auth/profile`;
export const CHANGE_PASSWORD_URL = `${environment.apiUrl}/api/auth/change-password`;

/** Claims we read from the access token (issued by CMS.API AuthController). */
interface TokenClaims {
  exp?: number;
  role?: string | string[];
}

/** Decodes the JWT payload (no signature check — the API does that). Null if malformed. */
export function decodeToken(token: string): TokenClaims | null {
  try {
    const part = token.split('.')[1];
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as TokenClaims;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _profile = signal<UserProfile | null>(
    loadSession<UserProfile>(AUTH_PROFILE_KEY),
  );
  readonly profile = this._profile.asReadonly();

  /** RoleIds from the token's `role` claim (a string for one role, an array for several). */
  readonly roles = computed<string[]>(() => {
    const role = this.claims()?.role;
    return role === undefined ? [] : Array.isArray(role) ? role : [role];
  });

  private readonly claims = computed(() => {
    const token = this._profile()?.accessToken;
    return token ? decodeToken(token) : null;
  });

  get token(): string | null {
    return this._profile()?.accessToken ?? null;
  }

  /** Signed in = a stored token that is not expired. */
  isLoggedIn(): boolean {
    const exp = this.claims()?.exp;
    return !!this.token && (exp === undefined || exp * 1000 > Date.now());
  }

  hasRole(roleId: string): boolean {
    return this.roles().includes(roleId);
  }

  login(request: LoginRequest): Observable<UserProfile> {
    return this.http.post<UserProfile>(LOGIN_URL, request).pipe(
      tap((profile) => {
        saveSession(AUTH_PROFILE_KEY, profile);
        this._profile.set(profile);
      }),
    );
  }

  /**
   * My Profile: saves the signed-in user's UserName (the API takes the user from the token),
   * then updates the stored profile so the shell shows the new name. The token is unchanged.
   */
  updateProfile(userName: string): Observable<ProfileResponse> {
    return this.http.put<ProfileResponse>(PROFILE_URL, { userName }).pipe(
      tap((res) => {
        const current = this._profile();
        if (!current) return;
        const next = { ...current, userName: res.userName };
        saveSession(AUTH_PROFILE_KEY, next);
        this._profile.set(next);
      }),
    );
  }

  /** Changes the signed-in user's password. A wrong current password is a 400 (not 401), so no sign-out. */
  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.http.post<void>(CHANGE_PASSWORD_URL, request);
  }

  /** Clears ALL of sessionStorage (profile and saved list state) and goes to /login. */
  logout(returnUrl?: string): void {
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
    this._profile.set(null);
    const queryParams = returnUrl && !returnUrl.startsWith('/login') ? { returnUrl } : {};
    this.router.navigate(['/login'], { queryParams });
  }
}

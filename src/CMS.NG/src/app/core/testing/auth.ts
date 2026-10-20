import { AUTH_PROFILE_KEY } from '../auth/auth.service';
import { UserProfile } from '../models/auth.model';

function base64Url(value: object): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Unsigned JWT shaped like CMS.API's (the client never checks signatures). Expires in 24h by default. */
export function fakeToken(claims: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: 'helen', name: 'helen', iat: now, exp: now + 24 * 3600, ...claims };
  return `${base64Url({ alg: 'HS256', typ: 'JWT' })}.${base64Url(payload)}.signature`;
}

/** Stores a profile in sessionStorage, as a successful login does. Call before AuthService is created. */
export function signInForTest(roles: string[] = ['Admin'], userName = '海倫'): UserProfile {
  const profile: UserProfile = {
    userId: 'helen',
    userName,
    // one role → string claim, several → array (as the API issues them)
    accessToken: fakeToken({ name: userName, role: roles.length === 1 ? roles[0] : roles }),
  };
  sessionStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

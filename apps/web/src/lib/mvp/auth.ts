import { decodeSignedToken, encodeSignedToken } from './session.ts';

export const AUTH_COOKIE_NAME = 'lyga_auth';
const AUTH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AuthSession {
  userId: string;
  email: string;
  exp?: number;
}

export function encodeAuthToken(session: Omit<AuthSession, 'exp'>, ttlMs = AUTH_TTL_MS): string {
  return encodeSignedToken<AuthSession>('auth', {
    ...session,
    exp: Date.now() + ttlMs,
  });
}

export function decodeAuthToken(token: string | undefined | null): AuthSession | null {
  const parsed = decodeSignedToken<Partial<AuthSession>>('auth', token);
  if (
    !parsed ||
    typeof parsed.userId !== 'string' ||
    typeof parsed.email !== 'string' ||
    typeof parsed.exp !== 'number' ||
    parsed.exp <= Date.now()
  ) {
    return null;
  }
  return { userId: parsed.userId, email: parsed.email, exp: parsed.exp };
}

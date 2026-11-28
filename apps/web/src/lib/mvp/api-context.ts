import { cookies } from 'next/headers.js';
import { NextResponse } from 'next/server.js';
import { PLANS } from '../pricingplan.ts';
import { AUTH_COOKIE_NAME, decodeAuthToken } from './auth.ts';
import {
  decodeSessionToken,
  encodeSessionToken,
  SESSION_COOKIE_NAME,
} from './session.ts';

export type SessionPayload = NonNullable<ReturnType<typeof decodeSessionToken>>;
export type AuthPayload = NonNullable<ReturnType<typeof decodeAuthToken>>;

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

export type StoreErrorReason =
  | 'unauthorized'
  | 'not_found'
  | 'file_too_large'
  | 'storage_full'
  | 'device_limit'
  | 'last_device'
  | 'invalid';

export function setSessionCookie(res: NextResponse, payload: SessionPayload): void {
  const token = encodeSessionToken(payload);
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: THIRTY_DAYS_SECONDS,
  });
}

export function mapStoreError(
  reason: StoreErrorReason,
  customMessages?: Partial<Record<StoreErrorReason, string>>
): NextResponse {
  switch (reason) {
    case 'file_too_large':
      return NextResponse.json(
        { error: customMessages?.file_too_large ?? `Free plan supports files up to ${PLANS.free.maxFileLabel}.`, code: 'FILE_TOO_LARGE' },
        { status: 413 }
      );
    case 'storage_full':
      return NextResponse.json(
        { error: customMessages?.storage_full ?? `Free plan ${PLANS.free.maxStorageLabel} storage limit reached.`, code: 'STORAGE_FULL' },
        { status: 413 }
      );
    case 'device_limit':
      return NextResponse.json(
        { error: customMessages?.device_limit ?? 'Free plan is limited to 2 paired devices.', code: 'DEVICE_LIMIT' },
        { status: 403 }
      );
    case 'last_device':
      return NextResponse.json(
        { error: customMessages?.last_device ?? 'Cannot remove the only remaining device in the workspace.' },
        { status: 409 }
      );
    case 'not_found':
      return NextResponse.json(
        { error: customMessages?.not_found ?? 'Not found.' },
        { status: 404 }
      );
    case 'invalid':
      return NextResponse.json(
        { error: customMessages?.invalid ?? 'Invalid request.' },
        { status: 400 }
      );
    case 'unauthorized':
    default:
      return NextResponse.json(
        { error: customMessages?.unauthorized ?? 'Unauthorized.' },
        { status: 401 }
      );
  }
}

/**
 * Wrap an MVP route handler with session cookie verification and uniform 500 error handling.
 */
export async function withWorkspaceSession(
  logLabel: string,
  errorMessage: string,
  handler: (ctx: { session: SessionPayload; auth: AuthPayload | null }) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const session = decodeSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const auth = decodeAuthToken(cookieStore.get(AUTH_COOKIE_NAME)?.value);
    return await handler({ session, auth });
  } catch (err) {
    console.error(`[${logLabel}]`, err);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/** Best-effort per-instance sliding-window rate limiter for anonymous endpoints. */
export function checkRateLimit(req: Request, bucket: string, limit = 20, windowMs = 60_000): boolean {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = fwd || req.headers.get('x-real-ip')?.trim() || 'unknown';
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count += 1;
  return true;
}

import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE_NAME = 'lyga_ws';

export interface WorkspaceSession {
  workspaceId: string;
  deviceId: string;
}

function getSecret(): string {
  const envSecret = process.env.LYGA_SESSION_SECRET;
  if (envSecret && envSecret.length >= 16) return envSecret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('LYGA_SESSION_SECRET is required in production.');
  }
  return 'lyga-local-dev-session-secret-change-in-prod';
}

function sign(purpose: string, payloadB64: string): string {
  return createHmac('sha256', getSecret())
    .update(`${purpose}:${payloadB64}`)
    .digest('base64url');
}

export function encodeSignedToken<T extends object>(purpose: string, payload: T): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${payloadB64}.${sign(purpose, payloadB64)}`;
}

export function decodeSignedToken<T>(purpose: string, token: string | undefined | null): T | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [payloadB64, sig] = parts;

  const expected = sign(purpose, payloadB64);
  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export function encodeSessionToken(session: WorkspaceSession): string {
  return encodeSignedToken('ws', session);
}

export function decodeSessionToken(token: string | undefined | null): WorkspaceSession | null {
  const parsed = decodeSignedToken<Partial<WorkspaceSession>>('ws', token);
  if (parsed && typeof parsed.workspaceId === 'string' && typeof parsed.deviceId === 'string') {
    return { workspaceId: parsed.workspaceId, deviceId: parsed.deviceId };
  }
  return null;
}

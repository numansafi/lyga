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

function sign(payloadB64: string): string {
  return createHmac('sha256', getSecret()).update(payloadB64).digest('base64url');
}

export function encodeSessionToken(session: WorkspaceSession): string {
  const payloadB64 = Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function decodeSessionToken(token: string | undefined | null): WorkspaceSession | null {
  if (!token || !token.includes('.')) return null;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return null;

  const expected = sign(payloadB64);
  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as Partial<WorkspaceSession>;
    if (typeof parsed.workspaceId === 'string' && typeof parsed.deviceId === 'string') {
      return { workspaceId: parsed.workspaceId, deviceId: parsed.deviceId };
    }
    return null;
  } catch {
    return null;
  }
}

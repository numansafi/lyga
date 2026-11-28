import { NextResponse } from 'next/server';
import { withWorkspaceSession } from '@/lib/mvp/api-context';
import { consumePinPepperAttempt, derivePinPepper } from '@/lib/mvp/pin-pepper';
import { getWorkspaceState, getWorkspaceWrappedKey } from '@/lib/mvp/workspace-store';

export async function POST(req: Request) {
  return withWorkspaceSession(
    'mvp workspace/pin-pepper POST',
    'Unable to process Sync PIN.',
    async ({ session }) => {
      const state = await getWorkspaceState(session.workspaceId, session.deviceId);
      if (!state) {
        return NextResponse.json(
          { error: 'This device was disconnected.', code: 'DEVICE_DISCONNECTED' },
          { status: 401 }
        );
      }

      const body = (await req.json().catch(() => null)) as {
        pinHash?: unknown;
        mode?: unknown;
      } | null;

      const pinHash = typeof body?.pinHash === 'string' ? body.pinHash.trim() : '';
      const requestedSetup = body?.mode === 'setup';
      const existingWrap = requestedSetup ? await getWorkspaceWrappedKey(session.workspaceId) : null;
      const mode: 'setup' | 'unlock' = requestedSetup && !existingWrap ? 'setup' : 'unlock';

      if (!/^[A-Za-z0-9_-]{32,64}$/.test(pinHash)) {
        return NextResponse.json({ error: 'Invalid Sync PIN request.' }, { status: 400 });
      }

      const rate = await consumePinPepperAttempt(session.workspaceId, mode);
      if (!rate.allowed) {
        const mins = Math.max(1, Math.ceil(rate.retryAfterSec / 60));
        return NextResponse.json(
          {
            error: `Too many Sync PIN attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`,
            retryAfterSec: rate.retryAfterSec,
          },
          { status: 429 }
        );
      }

      return NextResponse.json({
        pepper: derivePinPepper(session.workspaceId, pinHash),
        remaining: rate.remaining,
      });
    }
  );
}

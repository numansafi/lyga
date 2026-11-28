import { NextResponse } from 'next/server';
import { withWorkspaceSession } from '@/lib/mvp/api-context';
import { approveQrLoginChallenge } from '@/lib/mvp/qr-login-store';
import { getWorkspaceState } from '@/lib/mvp/workspace-store';

export async function POST(req: Request) {
  return withWorkspaceSession(
    'mvp qr-login approve POST',
    'Could not approve QR sign-in.',
    async ({ session, auth }) => {
      const body = (await req.json().catch(() => null)) as {
        id?: unknown;
        encryptedWmk?: unknown;
      } | null;

      const id = typeof body?.id === 'string' ? body.id.trim() : '';
      const encryptedWmk =
        typeof body?.encryptedWmk === 'string' ? body.encryptedWmk.trim() : '';

      if (!id || !encryptedWmk) {
        return NextResponse.json({ error: 'Missing QR approval fields.' }, { status: 400 });
      }

      const ws = await getWorkspaceState(session.workspaceId, session.deviceId);
      if (!ws || (auth && ws.workspace.user_id && ws.workspace.user_id !== auth.userId)) {
        return NextResponse.json(
          { error: 'Device session is no longer active. Sign in again.' },
          { status: 401 }
        );
      }

      const ok = await approveQrLoginChallenge(id, ws.workspace.pair_code, encryptedWmk);
      if (!ok) {
        return NextResponse.json(
          { error: 'QR code expired. Refresh the QR code on your computer and try again.' },
          { status: 410 }
        );
      }

      return NextResponse.json({ ok: true });
    }
  );
}

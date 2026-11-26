import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decodeSessionToken, SESSION_COOKIE_NAME } from '@/lib/mvp/session';
import { removeWorkspaceDevice } from '@/lib/mvp/workspace-store';

export async function DELETE(req: Request) {
  try {
    const cookieStore = await cookies();
    const session = decodeSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const targetDeviceId = new URL(req.url).searchParams.get('id')?.trim() ?? '';
    if (!targetDeviceId) {
      return NextResponse.json({ error: 'Device ID is required.' }, { status: 400 });
    }

    const result = await removeWorkspaceDevice(
      session.workspaceId,
      session.deviceId,
      targetDeviceId
    );
    if (!result.ok) {
      if (result.reason === 'last_device') {
        return NextResponse.json(
          { error: 'Cannot remove the only remaining device in the workspace.' },
          { status: 409 }
        );
      }
      if (result.reason === 'not_found') {
        return NextResponse.json({ error: 'Device not found.' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[mvp devices DELETE]', err);
    return NextResponse.json({ error: 'Unable to remove device.' }, { status: 500 });
  }
}

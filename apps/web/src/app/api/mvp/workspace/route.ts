import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  decodeSessionToken,
  encodeSessionToken,
  SESSION_COOKIE_NAME,
} from '@/lib/mvp/session';
import {
  createWorkspaceWithDevice,
  getWorkspaceState,
} from '@/lib/mvp/workspace-store';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSessionToken(token);

    if (session) {
      const state = await getWorkspaceState(session.workspaceId, session.deviceId);
      if (state) {
        return NextResponse.json({
          ...state,
          deviceId: session.deviceId,
        });
      }
      const res = NextResponse.json({ error: 'Device disconnected.' }, { status: 401 });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }

    const { workspace, device } = await createWorkspaceWithDevice('Desktop Browser');
    const newToken = encodeSessionToken({
      workspaceId: workspace.id,
      deviceId: device.id,
    });

    const res = NextResponse.json({
      workspace,
      devices: [device],
      items: [],
      usedBytes: 0,
      deviceId: device.id,
    });

    res.cookies.set(SESSION_COOKIE_NAME, newToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch (err) {
    console.error('[mvp workspace GET]', err);
    return NextResponse.json({ error: 'Unable to load workspace.' }, { status: 500 });
  }
}

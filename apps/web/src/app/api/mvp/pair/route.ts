import { NextResponse } from 'next/server';
import { encodeSessionToken, SESSION_COOKIE_NAME } from '@/lib/mvp/session';
import { pairDeviceByCode } from '@/lib/mvp/workspace-store';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { code?: unknown; label?: unknown } | null;
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    const label = typeof body?.label === 'string' ? body.label.trim() : 'Phone Browser';

    if (!code) {
      return NextResponse.json({ error: 'Pairing code is required.' }, { status: 400 });
    }

    const result = await pairDeviceByCode(code, label);
    if (!result.ok) {
      if (result.reason === 'device_limit') {
        return NextResponse.json(
          { error: 'Free plan is limited to 2 paired devices.', code: 'DEVICE_LIMIT' },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
    }

    const token = encodeSessionToken({
      workspaceId: result.workspace.id,
      deviceId: result.device.id,
    });

    const res = NextResponse.json({
      ok: true,
      workspaceId: result.workspace.id,
      deviceId: result.device.id,
    });

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch (err) {
    console.error('[mvp pair POST]', err);
    return NextResponse.json({ error: 'Unable to pair device.' }, { status: 500 });
  }
}

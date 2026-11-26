import { NextResponse } from 'next/server';
import {
  createQrLoginChallenge,
  pollQrLoginChallenge,
} from '@/lib/mvp/qr-login-store';
import { encodeSessionToken, SESSION_COOKIE_NAME } from '@/lib/mvp/session';
import { pairDeviceByCode } from '@/lib/mvp/workspace-store';

export async function POST() {
  try {
    const challenge = await createQrLoginChallenge();
    return NextResponse.json(challenge);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unable to create QR session.' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id')?.trim() ?? '';
  const secret = url.searchParams.get('secret')?.trim() ?? '';
  const label = url.searchParams.get('label')?.trim() || 'Desktop Browser';

  if (!id || !secret) {
    return NextResponse.json({ status: 'expired' }, { status: 400 });
  }

  try {
    const state = await pollQrLoginChallenge(id, secret);
    if (state.status !== 'approved') {
      return NextResponse.json(state);
    }

    const paired = await pairDeviceByCode(state.pairCode, label);
    if (!paired.ok) {
      return NextResponse.json(
        {
          status: 'error',
          error:
            paired.reason === 'device_limit'
              ? 'Free plan is limited to 2 paired devices.'
              : 'Workspace not found.',
        },
        { status: paired.reason === 'device_limit' ? 403 : 404 }
      );
    }

    const token = encodeSessionToken({
      workspaceId: paired.workspace.id,
      deviceId: paired.device.id,
    });

    const res = NextResponse.json({
      status: 'approved',
      workspaceId: paired.workspace.id,
      encryptedWmk: state.encryptedWmk,
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
    return NextResponse.json(
      {
        status: 'error',
        error: err instanceof Error ? err.message : 'Unable to complete QR pairing.',
      },
      { status: 500 }
    );
  }
}

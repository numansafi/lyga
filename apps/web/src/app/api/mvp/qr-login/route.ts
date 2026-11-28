import { NextResponse } from 'next/server';
import { checkRateLimit, setSessionCookie } from '@/lib/mvp/api-context';
import {
  createQrLoginChallenge,
  pollQrLoginChallenge,
} from '@/lib/mvp/qr-login-store';
import { pairDeviceByCode } from '@/lib/mvp/workspace-store';

export async function POST(req: Request) {
  if (!checkRateLimit(req, 'qr-login', 20, 60_000)) {
    return NextResponse.json({ error: 'Too many QR requests. Try again shortly.' }, { status: 429 });
  }
  try {
    const challenge = await createQrLoginChallenge();
    return NextResponse.json(challenge);
  } catch (err) {
    console.error('[mvp qr-login POST]', err);
    return NextResponse.json(
      { error: 'Unable to create QR session.' },
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

    const res = NextResponse.json({
      status: 'approved',
      workspaceId: paired.workspace.id,
      encryptedWmk: state.encryptedWmk,
    });

    setSessionCookie(res, {
      workspaceId: paired.workspace.id,
      deviceId: paired.device.id,
    });

    return res;
  } catch (err) {
    console.error('[mvp qr-login GET]', err);
    return NextResponse.json(
      {
        status: 'error',
        error: 'Unable to complete QR pairing.',
      },
      { status: 500 }
    );
  }
}

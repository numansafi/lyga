import { NextResponse } from 'next/server';
import { checkRateLimit, mapStoreError, setSessionCookie } from '@/lib/mvp/api-context';
import { pairDeviceByCode } from '@/lib/mvp/workspace-store';

export async function POST(req: Request) {
  if (!checkRateLimit(req, 'pair', 15, 60_000)) {
    return NextResponse.json({ error: 'Too many pairing attempts. Try again shortly.' }, { status: 429 });
  }
  try {
    const body = (await req.json().catch(() => null)) as { code?: unknown; label?: unknown } | null;
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    const label = typeof body?.label === 'string' ? body.label.trim() : 'Phone Browser';

    if (!code) {
      return NextResponse.json({ error: 'Pairing code is required.' }, { status: 400 });
    }

    const result = await pairDeviceByCode(code, label);
    if (!result.ok) {
      return mapStoreError(result.reason, { not_found: 'Workspace not found.' });
    }

    const res = NextResponse.json({
      ok: true,
      workspaceId: result.workspace.id,
      deviceId: result.device.id,
    });

    setSessionCookie(res, {
      workspaceId: result.workspace.id,
      deviceId: result.device.id,
    });

    return res;
  } catch (err) {
    console.error('[mvp pair POST]', err);
    return NextResponse.json({ error: 'Unable to pair device.' }, { status: 500 });
  }
}

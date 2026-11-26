import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createUploadUrl } from '@/lib/mvp/blob-store';
import { FREE_MAX_FILE_BYTES } from '@/lib/mvp/constants';
import { decodeSessionToken, SESSION_COOKIE_NAME } from '@/lib/mvp/session';
import { getWorkspaceState } from '@/lib/mvp/workspace-store';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const session = decodeSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as { sizeBytes?: unknown } | null;
    const sizeBytes =
      typeof body?.sizeBytes === 'number' && Number.isFinite(body.sizeBytes) && body.sizeBytes > 0
        ? Math.floor(body.sizeBytes)
        : 0;

    if (sizeBytes <= 0) {
      return NextResponse.json({ error: 'Valid sizeBytes is required.' }, { status: 400 });
    }

    if (sizeBytes > FREE_MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: 'Free plan supports files up to 500 MB.', code: 'FILE_TOO_LARGE' },
        { status: 413 }
      );
    }

    const state = await getWorkspaceState(session.workspaceId, session.deviceId);
    if (!state) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    if (state.usedBytes + sizeBytes > state.workspace.storage_limit_bytes) {
      return NextResponse.json(
        { error: 'Free plan 2 GB storage limit reached.', code: 'STORAGE_FULL' },
        { status: 413 }
      );
    }

    const blobKey = `ws_${randomBytes(16).toString('hex')}`;
    const target = await createUploadUrl(blobKey);

    return NextResponse.json({ blobKey, uploadUrl: target.url, mode: target.mode });
  } catch (err) {
    console.error('[mvp upload-url POST]', err);
    return NextResponse.json({ error: 'Unable to prepare upload.' }, { status: 500 });
  }
}

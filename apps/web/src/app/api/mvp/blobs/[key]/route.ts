import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { assertSafeBlobKey, readLocalBlob, saveLocalBlob } from '@/lib/mvp/blob-store';
import { FREE_MAX_FILE_BYTES } from '@/lib/mvp/constants';
import { decodeSessionToken, SESSION_COOKIE_NAME } from '@/lib/mvp/session';
import { getWorkspaceState } from '@/lib/mvp/workspace-store';

// Allow up to 4 MB overhead for AES-GCM IV/tag framing across 5 MB chunks
const MAX_ENCRYPTED_UPLOAD_BYTES = FREE_MAX_FILE_BYTES + 4 * 1024 * 1024;

export async function PUT(
  req: Request,
  context: { params: Promise<{ key: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = decodeSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const state = await getWorkspaceState(session.workspaceId, session.deviceId);
    if (!state) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const contentLen = Number(req.headers.get('content-length') ?? '0');
    if (Number.isFinite(contentLen) && contentLen > MAX_ENCRYPTED_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File exceeds size limit.' }, { status: 413 });
    }

    const { key } = await context.params;
    assertSafeBlobKey(key);

    const buf = new Uint8Array(await req.arrayBuffer());
    if (buf.byteLength > MAX_ENCRYPTED_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File exceeds size limit.' }, { status: 413 });
    }
    if (state.usedBytes + buf.byteLength > state.workspace.storage_limit_bytes + 4 * 1024 * 1024) {
      return NextResponse.json({ error: 'Workspace storage limit reached.' }, { status: 413 });
    }

    await saveLocalBlob(key, buf);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[mvp blobs PUT]', err);
    return NextResponse.json({ error: 'Unable to store blob.' }, { status: 400 });
  }
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ key: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = decodeSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { key } = await context.params;
    assertSafeBlobKey(key);

    const state = await getWorkspaceState(session.workspaceId, session.deviceId);
    if (!state || !state.items.some((it) => it.blob_key === key)) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }

    const data = await readLocalBlob(key);
    if (!data) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('[mvp blobs GET]', err);
    return NextResponse.json({ error: 'Unable to read blob.' }, { status: 400 });
  }
}

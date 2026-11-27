import { after, NextResponse } from 'next/server';
import { withWorkspaceSession } from '@/lib/mvp/api-context';
import { assertSafeBlobKey, readLocalBlob, saveLocalBlob } from '@/lib/mvp/blob-store';
import { FREE_MAX_FILE_BYTES } from '@/lib/mvp/constants';
import { getWorkspaceState } from '@/lib/mvp/workspace-store';

// Allow up to 4 MB overhead for AES-GCM IV/tag framing across 5 MB chunks
const MAX_ENCRYPTED_UPLOAD_BYTES = FREE_MAX_FILE_BYTES + 4 * 1024 * 1024;

export async function PUT(
  req: Request,
  context: { params: Promise<{ key: string }> }
) {
  return withWorkspaceSession('mvp blobs PUT', 'Unable to store blob.', async ({ session }) => {
    const contentLen = Number(req.headers.get('content-length') ?? '0');
    if (Number.isFinite(contentLen) && contentLen > MAX_ENCRYPTED_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File exceeds size limit.' }, { status: 413 });
    }

    const [{ key }, state] = await Promise.all([
      context.params,
      getWorkspaceState(session.workspaceId, session.deviceId, after),
    ]);
    if (!state) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    try {
      assertSafeBlobKey(key);
    } catch {
      return NextResponse.json({ error: 'Unable to store blob.' }, { status: 400 });
    }

    const buf = new Uint8Array(await req.arrayBuffer());
    if (buf.byteLength > MAX_ENCRYPTED_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File exceeds size limit.' }, { status: 413 });
    }
    if (state.usedBytes + buf.byteLength > state.workspace.storage_limit_bytes + 4 * 1024 * 1024) {
      return NextResponse.json({ error: 'Workspace storage limit reached.' }, { status: 413 });
    }

    await saveLocalBlob(key, buf);
    return NextResponse.json({ ok: true });
  });
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ key: string }> }
) {
  return withWorkspaceSession('mvp blobs GET', 'Unable to read blob.', async ({ session }) => {
    const [{ key }, state] = await Promise.all([
      context.params,
      getWorkspaceState(session.workspaceId, session.deviceId, after),
    ]);
    try {
      assertSafeBlobKey(key);
    } catch {
      return NextResponse.json({ error: 'Unable to read blob.' }, { status: 400 });
    }

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
  });
}

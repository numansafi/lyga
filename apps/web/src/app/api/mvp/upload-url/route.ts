import { randomBytes } from 'node:crypto';
import { after, NextResponse } from 'next/server';
import { mapStoreError, withWorkspaceSession } from '@/lib/mvp/api-context';
import { createUploadUrl } from '@/lib/mvp/blob-store';
import { FREE_MAX_FILE_BYTES } from '@/lib/mvp/constants';
import { getWorkspaceState } from '@/lib/mvp/workspace-store';

export async function POST(req: Request) {
  return withWorkspaceSession('mvp upload-url POST', 'Unable to prepare upload.', async ({ session }) => {
    const body = (await req.json().catch(() => null)) as { sizeBytes?: unknown } | null;
    const sizeBytes =
      typeof body?.sizeBytes === 'number' && Number.isFinite(body.sizeBytes) && body.sizeBytes > 0
        ? Math.floor(body.sizeBytes)
        : 0;

    if (sizeBytes <= 0) {
      return NextResponse.json({ error: 'Valid sizeBytes is required.' }, { status: 400 });
    }

    if (sizeBytes > FREE_MAX_FILE_BYTES) {
      return mapStoreError('file_too_large');
    }

    const state = await getWorkspaceState(session.workspaceId, session.deviceId, after);
    if (!state) {
      return mapStoreError('unauthorized');
    }

    if (state.usedBytes + sizeBytes > state.workspace.storage_limit_bytes) {
      return mapStoreError('storage_full');
    }

    const blobKey = `ws_${randomBytes(16).toString('hex')}`;
    const target = await createUploadUrl(blobKey);

    return NextResponse.json({ blobKey, uploadUrl: target.url, mode: target.mode });
  });
}

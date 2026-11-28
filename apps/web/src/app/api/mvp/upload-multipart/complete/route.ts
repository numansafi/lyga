import { after, NextResponse } from 'next/server';
import { mapStoreError, withWorkspaceSession } from '@/lib/mvp/api-context';
import {
  assertSafeBlobKey,
  completeMultipartUpload,
  deleteBlob,
} from '@/lib/mvp/blob-store';
import {
  addFeedItem,
  getWorkspaceState,
  releaseUploadQuota,
  verifyUploadSession,
} from '@/lib/mvp/workspace-store';

export async function POST(req: Request) {
  return withWorkspaceSession(
    'mvp upload-multipart complete POST',
    'Unable to complete multipart upload.',
    async ({ session }) => {
      const body = (await req.json().catch(() => null)) as {
        blobKey?: unknown;
        uploadId?: unknown;
        kind?: unknown;
        encryptedMeta?: unknown;
        chunkCount?: unknown;
      } | null;

      const blobKey = typeof body?.blobKey === 'string' ? body.blobKey : '';
      const uploadId = typeof body?.uploadId === 'string' ? body.uploadId : '';
      const kind = body?.kind === 'media' || body?.kind === 'file' ? body.kind : null;
      const encryptedMeta =
        typeof body?.encryptedMeta === 'string' ? body.encryptedMeta : '';
      const chunkCount =
        typeof body?.chunkCount === 'number' &&
        Number.isInteger(body.chunkCount) &&
        body.chunkCount >= 1
          ? body.chunkCount
          : 0;

      if (!blobKey || !uploadId || !kind || !encryptedMeta || chunkCount <= 0) {
        return NextResponse.json(
          { error: 'Missing required multipart completion fields.' },
          { status: 400 }
        );
      }

      try {
        assertSafeBlobKey(blobKey);
      } catch {
        return NextResponse.json({ error: 'Invalid blobKey.' }, { status: 400 });
      }

      const [state, owned] = await Promise.all([
        getWorkspaceState(session.workspaceId, session.deviceId, after),
        verifyUploadSession(session.workspaceId, blobKey, uploadId),
      ]);
      if (!state) {
        return mapStoreError('unauthorized');
      }
      if (!owned.ok) {
        return NextResponse.json({ error: 'Upload session not found.' }, { status: 404 });
      }

      try {
        const { sizeBytes } = await completeMultipartUpload(blobKey, uploadId, chunkCount);
        await releaseUploadQuota(session.workspaceId, blobKey);

        const result = await addFeedItem({
          workspaceId: session.workspaceId,
          deviceId: session.deviceId,
          kind,
          encryptedMeta,
          encryptedBody: null,
          blobKey,
          sizeBytes,
          chunkCount,
        });

        if (!result.ok) {
          await deleteBlob(blobKey).catch(() => undefined);
          return mapStoreError(result.reason);
        }

        return NextResponse.json({ item: result.item, sizeBytes }, { status: 201 });
      } catch (err) {
        await releaseUploadQuota(session.workspaceId, blobKey).catch(() => undefined);
        throw err;
      }
    }
  );
}

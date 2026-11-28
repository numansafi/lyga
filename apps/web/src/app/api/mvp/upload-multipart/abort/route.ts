import { after, NextResponse } from 'next/server';
import { mapStoreError, withWorkspaceSession } from '@/lib/mvp/api-context';
import { abortMultipartUpload, assertSafeBlobKey } from '@/lib/mvp/blob-store';
import {
  getWorkspaceState,
  releaseUploadQuota,
  verifyUploadSession,
} from '@/lib/mvp/workspace-store';

export async function POST(req: Request) {
  return withWorkspaceSession(
    'mvp upload-multipart abort POST',
    'Unable to abort multipart upload.',
    async ({ session }) => {
      const body = (await req.json().catch(() => null)) as {
        blobKey?: unknown;
        uploadId?: unknown;
      } | null;

      const blobKey = typeof body?.blobKey === 'string' ? body.blobKey : '';
      const uploadId = typeof body?.uploadId === 'string' ? body.uploadId : '';

      if (!blobKey || !uploadId) {
        return NextResponse.json(
          { error: 'blobKey and uploadId are required.' },
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

      await abortMultipartUpload(blobKey, uploadId).catch(() => undefined);
      await releaseUploadQuota(session.workspaceId, blobKey);

      return NextResponse.json({ ok: true });
    }
  );
}

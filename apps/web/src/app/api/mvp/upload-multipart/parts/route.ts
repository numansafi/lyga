import { after, NextResponse } from 'next/server';
import { mapStoreError, withWorkspaceSession } from '@/lib/mvp/api-context';
import {
  assertSafeBlobKey,
  createMultipartPartUrls,
  listUploadedParts,
} from '@/lib/mvp/blob-store';
import { getWorkspaceState, verifyUploadSession } from '@/lib/mvp/workspace-store';

export async function POST(req: Request) {
  return withWorkspaceSession(
    'mvp upload-multipart parts POST',
    'Unable to sign upload parts.',
    async ({ session }) => {
      const body = (await req.json().catch(() => null)) as {
        blobKey?: unknown;
        uploadId?: unknown;
        partNumbers?: unknown;
      } | null;

      const blobKey = typeof body?.blobKey === 'string' ? body.blobKey : '';
      const uploadId = typeof body?.uploadId === 'string' ? body.uploadId : '';
      const partNumbers = Array.isArray(body?.partNumbers)
        ? body.partNumbers.filter(
            (n): n is number => Number.isInteger(n) && n >= 1 && n <= 10000
          )
        : [];

      if (!blobKey || !uploadId || partNumbers.length > 25) {
        return NextResponse.json(
          { error: 'Valid blobKey, uploadId, and up to 25 partNumbers are required.' },
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

      const [uploaded, signed] = await Promise.all([
        listUploadedParts(blobKey, uploadId),
        partNumbers.length > 0
          ? createMultipartPartUrls(blobKey, uploadId, partNumbers)
          : Promise.resolve({ urls: [], mode: 'r2' as const }),
      ]);

      return NextResponse.json({
        urls: signed.urls,
        uploadedParts: uploaded.map((p) => p.partNumber),
        mode: signed.mode,
      });
    }
  );
}

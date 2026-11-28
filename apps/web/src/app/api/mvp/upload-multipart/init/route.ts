import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { mapStoreError, withWorkspaceSession } from '@/lib/mvp/api-context';
import {
  abortMultipartUpload,
  createMultipartPartUrls,
  createMultipartUpload,
} from '@/lib/mvp/blob-store';
import {
  releaseUploadQuota,
  reserveUploadQuota,
} from '@/lib/mvp/workspace-store';

const INITIAL_URL_BATCH = 10;

export async function POST(req: Request) {
  return withWorkspaceSession(
    'mvp upload-multipart init POST',
    'Unable to start multipart upload.',
    async ({ session }) => {
      const body = (await req.json().catch(() => null)) as {
        sizeBytes?: unknown;
        totalParts?: unknown;
      } | null;

      const sizeBytes =
        typeof body?.sizeBytes === 'number' &&
        Number.isFinite(body.sizeBytes) &&
        body.sizeBytes > 0
          ? Math.floor(body.sizeBytes)
          : 0;
      const totalParts =
        typeof body?.totalParts === 'number' &&
        Number.isInteger(body.totalParts) &&
        body.totalParts >= 1 &&
        body.totalParts <= 10000
          ? body.totalParts
          : 0;

      if (sizeBytes <= 0 || totalParts <= 0) {
        return NextResponse.json(
          { error: 'Valid sizeBytes and totalParts are required.' },
          { status: 400 }
        );
      }

      const blobKey = `ws_${randomBytes(16).toString('hex')}`;
      const { uploadId, mode } = await createMultipartUpload(blobKey);

      try {
        const reservation = await reserveUploadQuota(
          session.workspaceId,
          session.deviceId,
          blobKey,
          uploadId,
          sizeBytes,
          totalParts
        );
        if (!reservation.ok) {
          await abortMultipartUpload(blobKey, uploadId).catch(() => undefined);
          if (reservation.reason === 'too_many_uploads') {
            return NextResponse.json(
              { error: 'Too many concurrent uploads. Wait for one to finish.' },
              { status: 429 }
            );
          }
          return mapStoreError(reservation.reason);
        }

        const batchCount = Math.min(INITIAL_URL_BATCH, totalParts);
        const partNumbers = Array.from({ length: batchCount }, (_, i) => i + 1);
        const { urls } = await createMultipartPartUrls(blobKey, uploadId, partNumbers);

        return NextResponse.json({
          blobKey,
          uploadId,
          mode,
          urls,
        });
      } catch (err) {
        await releaseUploadQuota(session.workspaceId, blobKey).catch(() => undefined);
        await abortMultipartUpload(blobKey, uploadId).catch(() => undefined);
        throw err;
      }
    }
  );
}

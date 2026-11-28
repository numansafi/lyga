import { after, NextResponse } from 'next/server';
import { withWorkspaceSession } from '@/lib/mvp/api-context';
import { assertSafeBlobKey, saveLocalMultipartPart } from '@/lib/mvp/blob-store';
import { MULTIPART_PART_WIRE_BYTES } from '@/lib/mvp/constants';
import { getWorkspaceState, verifyUploadSession } from '@/lib/mvp/workspace-store';

const MAX_PART_BYTES = MULTIPART_PART_WIRE_BYTES + 1024;

export async function PUT(
  req: Request,
  context: { params: Promise<{ key: string }> }
) {
  return withWorkspaceSession(
    'mvp blobs part PUT',
    'Unable to store upload part.',
    async ({ session }) => {
      const url = new URL(req.url);
      const uploadId = url.searchParams.get('uploadId') ?? '';
      const partNumber = Number(url.searchParams.get('partNumber') ?? '0');

      if (!uploadId || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
        return NextResponse.json({ error: 'Invalid uploadId or partNumber.' }, { status: 400 });
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
        return NextResponse.json({ error: 'Invalid blob key.' }, { status: 400 });
      }

      const owned = await verifyUploadSession(session.workspaceId, key, uploadId);
      if (!owned.ok) {
        return NextResponse.json({ error: 'Upload session not found.' }, { status: 404 });
      }

      const buf = new Uint8Array(await req.arrayBuffer());
      if (buf.byteLength === 0 || buf.byteLength > MAX_PART_BYTES) {
        return NextResponse.json({ error: 'Part size out of bounds.' }, { status: 413 });
      }

      await saveLocalMultipartPart(uploadId, partNumber, buf);
      return NextResponse.json({ ok: true });
    }
  );
}

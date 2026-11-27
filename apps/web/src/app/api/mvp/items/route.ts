import { NextResponse } from 'next/server';
import { mapStoreError, withWorkspaceSession } from '@/lib/mvp/api-context';
import { assertSafeBlobKey } from '@/lib/mvp/blob-store';
import type { FeedItemKind } from '@/lib/mvp/constants';
import {
  addFeedItem,
  clearWorkspaceFeed,
  removeFeedItem,
  updateFeedItem,
} from '@/lib/mvp/workspace-store';

const VALID_KINDS = new Set<FeedItemKind>(['text', 'link', 'code', 'media', 'file']);

export async function POST(req: Request) {
  return withWorkspaceSession('mvp items POST', 'Unable to save item.', async ({ session }) => {
    const body = (await req.json().catch(() => null)) as {
      kind?: unknown;
      encryptedMeta?: unknown;
      encryptedBody?: unknown;
      blobKey?: unknown;
      sizeBytes?: unknown;
      chunkCount?: unknown;
    } | null;

    if (
      !body ||
      typeof body.kind !== 'string' ||
      !VALID_KINDS.has(body.kind as FeedItemKind) ||
      typeof body.encryptedMeta !== 'string' ||
      !body.encryptedMeta
    ) {
      return NextResponse.json({ error: 'Invalid feed item payload.' }, { status: 400 });
    }

    const blobKey = typeof body.blobKey === 'string' && body.blobKey ? body.blobKey : null;
    if (blobKey) {
      try {
        assertSafeBlobKey(blobKey);
      } catch {
        return NextResponse.json({ error: 'Invalid blob key.' }, { status: 400 });
      }
    }

    const sizeBytes =
      typeof body.sizeBytes === 'number' && Number.isFinite(body.sizeBytes) && body.sizeBytes >= 0
        ? Math.floor(body.sizeBytes)
        : 0;
    const chunkCount =
      typeof body.chunkCount === 'number' && Number.isFinite(body.chunkCount) && body.chunkCount >= 0
        ? Math.floor(body.chunkCount)
        : 0;

    const result = await addFeedItem({
      workspaceId: session.workspaceId,
      deviceId: session.deviceId,
      kind: body.kind as FeedItemKind,
      encryptedMeta: body.encryptedMeta,
      encryptedBody: typeof body.encryptedBody === 'string' ? body.encryptedBody : null,
      blobKey,
      sizeBytes,
      chunkCount,
    });

    if (!result.ok) {
      return mapStoreError(result.reason);
    }

    return NextResponse.json({ ok: true, item: result.item });
  });
}

export async function DELETE(req: Request) {
  return withWorkspaceSession('mvp items DELETE', 'Unable to delete item.', async ({ session }) => {
    const url = new URL(req.url);
    if (url.searchParams.get('all') === 'true') {
      const cleared = await clearWorkspaceFeed(session.workspaceId, session.deviceId);
      if (!cleared) {
        return mapStoreError('unauthorized');
      }
      return NextResponse.json({ ok: true });
    }

    const id = url.searchParams.get('id') ?? '';
    if (!id) {
      return NextResponse.json({ error: 'Item ID is required.' }, { status: 400 });
    }

    const deleted = await removeFeedItem(session.workspaceId, session.deviceId, id);
    if (!deleted) {
      return mapStoreError('not_found', { not_found: 'Item not found.' });
    }

    return NextResponse.json({ ok: true });
  });
}

export async function PATCH(req: Request) {
  return withWorkspaceSession('mvp items PATCH', 'Unable to update item.', async ({ session }) => {
    const body = (await req.json().catch(() => null)) as {
      id?: unknown;
      kind?: unknown;
      encryptedMeta?: unknown;
      encryptedBody?: unknown;
    } | null;

    if (
      !body ||
      typeof body.id !== 'string' ||
      !body.id ||
      typeof body.kind !== 'string' ||
      !VALID_KINDS.has(body.kind as FeedItemKind) ||
      typeof body.encryptedMeta !== 'string' ||
      !body.encryptedMeta
    ) {
      return NextResponse.json({ error: 'Invalid update payload.' }, { status: 400 });
    }

    const updated = await updateFeedItem({
      workspaceId: session.workspaceId,
      deviceId: session.deviceId,
      itemId: body.id,
      kind: body.kind as FeedItemKind,
      encryptedMeta: body.encryptedMeta,
      encryptedBody: typeof body.encryptedBody === 'string' ? body.encryptedBody : null,
    });

    if (!updated) {
      return mapStoreError('not_found', { not_found: 'Item not found.' });
    }

    return NextResponse.json({ ok: true, item: updated });
  });
}

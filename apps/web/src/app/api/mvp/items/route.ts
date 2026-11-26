import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { assertSafeBlobKey } from '@/lib/mvp/blob-store';
import type { FeedItemKind } from '@/lib/mvp/constants';
import { decodeSessionToken, SESSION_COOKIE_NAME } from '@/lib/mvp/session';
import { addFeedItem, removeFeedItem, updateFeedItem } from '@/lib/mvp/workspace-store';

const VALID_KINDS = new Set<FeedItemKind>(['text', 'link', 'code', 'media', 'file']);

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const session = decodeSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

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
      if (result.reason === 'file_too_large') {
        return NextResponse.json(
          { error: 'Free plan supports files up to 500 MB.', code: 'FILE_TOO_LARGE' },
          { status: 413 }
        );
      }
      if (result.reason === 'storage_full') {
        return NextResponse.json(
          { error: 'Free plan 2 GB storage limit reached.', code: 'STORAGE_FULL' },
          { status: 413 }
        );
      }
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    return NextResponse.json({ ok: true, item: result.item });
  } catch (err) {
    console.error('[mvp items POST]', err);
    return NextResponse.json({ error: 'Unable to save item.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const cookieStore = await cookies();
    const session = decodeSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get('id') ?? '';
    if (!id) {
      return NextResponse.json({ error: 'Item ID is required.' }, { status: 400 });
    }

    const deleted = await removeFeedItem(session.workspaceId, session.deviceId, id);
    if (!deleted) {
      return NextResponse.json({ error: 'Item not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[mvp items DELETE]', err);
    return NextResponse.json({ error: 'Unable to delete item.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies();
    const session = decodeSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

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
      return NextResponse.json({ error: 'Item not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[mvp items PATCH]', err);
    return NextResponse.json({ error: 'Unable to update item.' }, { status: 500 });
  }
}

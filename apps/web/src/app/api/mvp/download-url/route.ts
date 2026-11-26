import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createDownloadUrl } from '@/lib/mvp/blob-store';
import { decodeSessionToken, SESSION_COOKIE_NAME } from '@/lib/mvp/session';
import { getWorkspaceState } from '@/lib/mvp/workspace-store';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const session = decodeSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const itemId = new URL(req.url).searchParams.get('id') ?? '';
    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required.' }, { status: 400 });
    }

    const state = await getWorkspaceState(session.workspaceId, session.deviceId);
    if (!state) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const item = state.items.find((it) => it.id === itemId);
    if (!item || !item.blob_key) {
      return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    }

    const target = await createDownloadUrl(item.blob_key);
    return NextResponse.json({ downloadUrl: target.url, mode: target.mode });
  } catch (err) {
    console.error('[mvp download-url GET]', err);
    return NextResponse.json({ error: 'Unable to prepare download.' }, { status: 500 });
  }
}

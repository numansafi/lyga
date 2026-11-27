import { after, NextResponse } from 'next/server';
import { mapStoreError, withWorkspaceSession } from '@/lib/mvp/api-context';
import { createDownloadUrl } from '@/lib/mvp/blob-store';
import { getWorkspaceState } from '@/lib/mvp/workspace-store';

export async function GET(req: Request) {
  return withWorkspaceSession('mvp download-url GET', 'Unable to prepare download.', async ({ session }) => {
    const itemId = new URL(req.url).searchParams.get('id') ?? '';
    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required.' }, { status: 400 });
    }

    const state = await getWorkspaceState(session.workspaceId, session.deviceId, after);
    if (!state) {
      return mapStoreError('unauthorized');
    }

    const item = state.items.find((it) => it.id === itemId);
    if (!item || !item.blob_key) {
      return mapStoreError('not_found', { not_found: 'File not found.' });
    }

    const target = await createDownloadUrl(item.blob_key);
    return NextResponse.json({ downloadUrl: target.url, mode: target.mode });
  });
}

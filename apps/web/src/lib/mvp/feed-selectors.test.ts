import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCategoryGroups,
  computeVaultBreakdown,
  formatBytes,
  getDateGroupLabel,
  getLinkPreviewInfo,
  getPreviewKind,
  type DecryptedFeedItem,
} from './feed-selectors.ts';

function makeItem(overrides: Partial<DecryptedFeedItem['raw']> & { title?: string; body?: string | null; mimeType?: string }): DecryptedFeedItem {
  return {
    raw: {
      id: overrides.id ?? 'id-1',
      workspace_id: 'ws-1',
      kind: overrides.kind ?? 'text',
      encrypted_meta: 'm',
      encrypted_body: null,
      blob_key: null,
      size_bytes: overrides.size_bytes ?? 0,
      chunk_count: 0,
      expires_at: null,
      created_at: overrides.created_at ?? '2026-11-27T12:00:00.000Z',
    },
    meta: {
      title: overrides.title ?? 'Item',
      fileName: overrides.title ?? 'Item',
      mimeType: overrides.mimeType,
      senderDeviceId: 'dev-1',
    },
    bodyText: overrides.body ?? null,
  };
}

describe('mvp feed-selectors', () => {
  it('formats bytes and classifies preview kinds', () => {
    assert.equal(formatBytes(512), '512 B');
    assert.equal(formatBytes(2048), '2 KB');
    assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB');
    assert.equal(getPreviewKind(makeItem({ title: 'clip.MOV', kind: 'media' })), 'video');
    assert.equal(getPreviewKind(makeItem({ title: 'photo.heic', kind: 'media' })), 'image');
    assert.equal(getPreviewKind(makeItem({ title: 'spec.pdf', kind: 'file' })), 'pdf');
  });

  it('extracts safe link previews and YouTube embed URLs', () => {
    assert.equal(getLinkPreviewInfo('javascript:alert(1)'), null);
    const yt = getLinkPreviewInfo('https://youtu.be/dQw4w9WgXcQ');
    assert.equal(yt?.hostname, 'youtu.be');
    assert.equal(yt?.youtubeEmbedUrl, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1');
  });

  it('groups category items with pinned first and computes vault breakdown', () => {
    const today = new Date().toISOString();
    const a = makeItem({ id: 'a', kind: 'file', title: 'alpha.pdf', size_bytes: 1024, created_at: today });
    const b = makeItem({ id: 'b', kind: 'file', title: 'beta.zip', size_bytes: 4096, created_at: today });
    const c = makeItem({ id: 'c', kind: 'media', title: 'pic.png', size_bytes: 2048, created_at: today });

    const groups = buildCategoryGroups({
      filter: 'file',
      items: [a, b, c],
      searchQuery: '',
      sortBy: 'largest',
      deviceFilter: 'all',
      deviceId: 'dev-1',
      pinnedIds: ['a'],
    });
    assert.equal(groups[0]?.label, 'Pinned');
    assert.equal(groups[0]?.items[0]?.raw.id, 'a');
    assert.equal(groups[1]?.label, 'Largest first');
    assert.equal(groups[1]?.items[0]?.raw.id, 'b');

    const breakdown = computeVaultBreakdown([a, b, c]);
    assert.equal(breakdown.fileCount, 2);
    assert.equal(breakdown.fileBytes, 5120);
    assert.equal(breakdown.mediaCount, 1);
    assert.equal(getDateGroupLabel(today), 'Today');
  });
});

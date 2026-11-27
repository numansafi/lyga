import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

let tempDir = '';

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'lyga-mvp-test-'));
  process.env.LYGA_MVP_DIR = tempDir;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

after(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

describe('mvp session & workspace-store', () => {
  it('signs and verifies workspace session tokens and rejects tampered tokens', async () => {
    const { encodeSessionToken, decodeSessionToken } = await import('./session.ts');
    const token = encodeSessionToken({ workspaceId: 'ws-1', deviceId: 'dev-1' });
    assert.deepEqual(decodeSessionToken(token), { workspaceId: 'ws-1', deviceId: 'dev-1' });
    assert.equal(decodeSessionToken(`${token}x`), null);
    assert.equal(decodeSessionToken(`${token}.extra`), null);
    assert.equal(decodeSessionToken('malformed'), null);

    const { encodeAuthToken, decodeAuthToken } = await import('./auth.ts');
    const authToken = encodeAuthToken({ userId: 'user-1', email: 'u@example.com' });
    const decodedAuth = decodeAuthToken(authToken);
    assert.equal(decodedAuth?.userId, 'user-1');
    assert.equal(decodedAuth?.email, 'u@example.com');
    assert.equal(decodeAuthToken(token), null);
    assert.equal(
      decodeAuthToken(encodeAuthToken({ userId: 'user-1', email: 'u@example.com' }, -1000)),
      null
    );
  });

  it('creates a workspace, enforces 2-device cap, and manages feed items + caps', async () => {
    const {
      createWorkspaceWithDevice,
      pairDeviceByCode,
      getWorkspaceState,
      addFeedItem,
      removeFeedItem,
      removeWorkspaceDevice,
      renameWorkspaceDevice,
      updateFeedItem,
    } = await import('./workspace-store.ts');
    const { FREE_MAX_FILE_BYTES } = await import('./constants.ts');

    const { workspace, device } = await createWorkspaceWithDevice('Windows Chrome');
    assert.ok(workspace.id);
    assert.ok(workspace.pair_code.length >= 6);

    const paired2 = await pairDeviceByCode(workspace.pair_code, 'iPhone Safari');
    assert.equal(paired2.ok, true);

    const paired3 = await pairDeviceByCode(workspace.pair_code, 'Third Device');
    assert.deepEqual(paired3, { ok: false, reason: 'device_limit' });

    const tooBig = await addFeedItem({
      workspaceId: workspace.id,
      deviceId: device.id,
      kind: 'file',
      encryptedMeta: 'enc-meta',
      encryptedBody: null,
      blobKey: 'ws_12345678',
      sizeBytes: FREE_MAX_FILE_BYTES + 1,
      chunkCount: 1,
    });
    assert.deepEqual(tooBig, { ok: false, reason: 'file_too_large' });

    const added = await addFeedItem({
      workspaceId: workspace.id,
      deviceId: device.id,
      kind: 'text',
      encryptedMeta: 'enc-meta',
      encryptedBody: 'enc-body',
      blobKey: null,
      sizeBytes: 0,
      chunkCount: 0,
    });
    assert.equal(added.ok, true);
    if (!added.ok) return;

    const state = await getWorkspaceState(workspace.id, device.id);
    assert.equal(state?.items.length, 1);
    assert.equal(state?.devices.length, 2);

    const updated = await updateFeedItem({
      workspaceId: workspace.id,
      deviceId: device.id,
      itemId: added.item.id,
      kind: 'code',
      encryptedMeta: 'meta-edited',
      encryptedBody: 'body-edited',
    });
    assert.equal(updated?.encrypted_body, 'body-edited');
    assert.equal(updated?.kind, 'code');

    const deleted = await removeFeedItem(workspace.id, device.id, added.item.id);
    assert.equal(deleted, true);

    const afterDelete = await getWorkspaceState(workspace.id, device.id);
    assert.equal(afterDelete?.items.length, 0);

    const bulk = await Promise.all([
      addFeedItem({
        workspaceId: workspace.id,
        deviceId: device.id,
        kind: 'text',
        encryptedMeta: 'm1',
        encryptedBody: 'b1',
        blobKey: null,
        sizeBytes: 0,
        chunkCount: 0,
      }),
      addFeedItem({
        workspaceId: workspace.id,
        deviceId: device.id,
        kind: 'text',
        encryptedMeta: 'm2',
        encryptedBody: 'b2',
        blobKey: null,
        sizeBytes: 0,
        chunkCount: 0,
      }),
    ]);
    const bulkIds = bulk.map((r) => (r.ok ? r.item.id : '')).filter(Boolean);
    assert.equal(bulkIds.length, 2);
    await Promise.all(bulkIds.map((id) => removeFeedItem(workspace.id, device.id, id)));
    const afterBulkDelete = await getWorkspaceState(workspace.id, device.id);
    assert.equal(afterBulkDelete?.items.length, 0);

    if (paired2.ok) {
      const renamed = await renameWorkspaceDevice(
        workspace.id,
        device.id,
        paired2.device.id,
        '  My iPhone 16  '
      );
      assert.deepEqual(renamed, { ok: true, label: 'My iPhone 16' });

      const removed = await removeWorkspaceDevice(workspace.id, device.id, paired2.device.id);
      assert.deepEqual(removed, { ok: true });

      const afterRemove = await getWorkspaceState(workspace.id, device.id);
      assert.equal(afterRemove?.devices.length, 1);

      const cannotRemoveLast = await removeWorkspaceDevice(workspace.id, device.id, device.id);
      assert.deepEqual(cannotRemoveLast, { ok: false, reason: 'last_device' });
    }
  });
});

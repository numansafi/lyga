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
      clearWorkspaceFeed,
      deleteWorkspaceAndAccount,
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

    // Clear feed removes items but keeps workspace + device
    assert.equal(await clearWorkspaceFeed(workspace.id, 'bad-device'), false);
    assert.equal(await clearWorkspaceFeed(workspace.id, device.id), true);
    const afterClear = await getWorkspaceState(workspace.id, device.id);
    assert.equal(afterClear?.items.length, 0);

    // Delete workspace wipes workspace & devices
    assert.equal(await deleteWorkspaceAndAccount(workspace.id, 'bad-device'), false);
    assert.equal(await deleteWorkspaceAndAccount(workspace.id, device.id), true);
    const afterWipe = await getWorkspaceState(workspace.id, device.id);
    assert.equal(afterWipe, null);
  });

  it('registers distinct devices per browser login up to max_devices', async () => {
    const { getOrCreateUserWorkspace } = await import('./workspace-store.ts');
    const first = await getOrCreateUserWorkspace('user-multi', 'Desktop Chrome');
    const second = await getOrCreateUserWorkspace('user-multi', 'Desktop Edge');
    assert.equal(first.workspace.id, second.workspace.id);
    assert.notEqual(first.deviceId, second.deviceId);
    assert.equal(second.devices.length, 2);
  });

  it('upgrades and downgrades workspace plan limits and resolves Stripe customer IDs', async () => {
    const {
      createWorkspaceWithDevice,
      findWorkspaceByStripeCustomerId,
      getWorkspaceState,
      setWorkspacePlan,
    } = await import('./workspace-store.ts');
    const { getWorkspaceLimits } = await import('./constants.ts');

    const { workspace, device } = await createWorkspaceWithDevice('Mac');
    assert.equal(getWorkspaceLimits(workspace).plan, 'free');

    const ok = await setWorkspacePlan(workspace.id, {
      plan: 'pro',
      stripeCustomerId: 'cus_test_123',
      stripeSubscriptionId: 'sub_test_123',
      subscriptionStatus: 'active',
    });
    assert.equal(ok, true);

    const proState = await getWorkspaceState(workspace.id, device.id);
    assert.equal(proState?.workspace.plan, 'pro');
    assert.equal(proState?.workspace.max_devices, 5);
    assert.equal(getWorkspaceLimits(proState?.workspace).expiryDays, null);

    const byCustomer = await findWorkspaceByStripeCustomerId('cus_test_123');
    assert.equal(byCustomer?.id, workspace.id);

    await setWorkspacePlan(workspace.id, {
      plan: 'free',
      subscriptionStatus: 'canceled',
    });
    const freeState = await getWorkspaceState(workspace.id, device.id);
    assert.equal(freeState?.workspace.plan, 'free');
    assert.equal(freeState?.workspace.max_devices, 2);
  });

  it('enforces upload session ownership, quota reservations, and max 3 concurrent uploads', async () => {
    const {
      createWorkspaceWithDevice,
      releaseUploadQuota,
      reserveUploadQuota,
      verifyUploadSession,
    } = await import('./workspace-store.ts');

    const wsA = await createWorkspaceWithDevice('Phone A');
    const wsB = await createWorkspaceWithDevice('Phone B');

    const r1 = await reserveUploadQuota(wsA.workspace.id, wsA.device.id, 'ws_blob_1_abcdefgh', 'up_1', 100 * 1024 * 1024, 7);
    assert.deepEqual(r1, { ok: true });

    // Cross-workspace ownership check must fail for wsB
    assert.deepEqual(await verifyUploadSession(wsB.workspace.id, 'ws_blob_1_abcdefgh', 'up_1'), { ok: false });
    assert.deepEqual(await verifyUploadSession(wsA.workspace.id, 'ws_blob_1_abcdefgh', 'up_1'), { ok: true, totalParts: 7 });

    // 2 more concurrent uploads allowed (total 3), 4th rejected
    assert.deepEqual(await reserveUploadQuota(wsA.workspace.id, wsA.device.id, 'ws_blob_2_abcdefgh', 'up_2', 50 * 1024 * 1024, 4), { ok: true });
    assert.deepEqual(await reserveUploadQuota(wsA.workspace.id, wsA.device.id, 'ws_blob_3_abcdefgh', 'up_3', 50 * 1024 * 1024, 4), { ok: true });
    assert.deepEqual(
      await reserveUploadQuota(wsA.workspace.id, wsA.device.id, 'ws_blob_4_abcdefgh', 'up_4', 50 * 1024 * 1024, 4),
      { ok: false, reason: 'too_many_uploads' }
    );

    await releaseUploadQuota(wsA.workspace.id, 'ws_blob_1_abcdefgh');
    assert.deepEqual(await verifyUploadSession(wsA.workspace.id, 'ws_blob_1_abcdefgh', 'up_1'), { ok: false });

    // Fill 880 MB via feed items (4 x 220 MB), plus 100 MB reserved = 980 MB; next 100 MB exceeds 1 GB
    const { addFeedItem } = await import('./workspace-store.ts');
    for (let i = 0; i < 4; i++) {
      await addFeedItem({
        workspaceId: wsA.workspace.id,
        deviceId: wsA.device.id,
        kind: 'file',
        encryptedMeta: `m${i}`,
        encryptedBody: null,
        blobKey: `ws_fill_${i}_abcdefgh`,
        sizeBytes: 220 * 1024 * 1024,
        chunkCount: 1,
      });
    }
    assert.deepEqual(
      await reserveUploadQuota(wsA.workspace.id, wsA.device.id, 'ws_blob_5_abcdefgh', 'up_5', 100 * 1024 * 1024, 7),
      { ok: false, reason: 'storage_full' }
    );
  });

  it('stores wrapped workspace key and blocks overwriting with a mismatched fingerprint', async () => {
    const {
      createWorkspaceWithDevice,
      getWorkspaceWrappedKey,
      saveWorkspaceWrappedKey,
    } = await import('./workspace-store.ts');

    const { workspace } = await createWorkspaceWithDevice('Primary Laptop');
    assert.equal(await getWorkspaceWrappedKey(workspace.id), null);

    const first = await saveWorkspaceWrappedKey(workspace.id, {
      wrappedWmk: 'cipher-1',
      salt: 'salt-1',
      iv: 'iv-1',
      iterations: 600_000,
      kind: 'password',
      fingerprint: 'fp-abc',
    });
    assert.deepEqual(first, { ok: true });

    const loaded = await getWorkspaceWrappedKey(workspace.id);
    assert.equal(loaded?.wrappedWmk, 'cipher-1');
    assert.equal(loaded?.kind, 'password');

    // Rotation with matching fingerprint succeeds
    const rotated = await saveWorkspaceWrappedKey(workspace.id, {
      wrappedWmk: 'cipher-2',
      salt: 'salt-2',
      iv: 'iv-2',
      iterations: 600_000,
      kind: 'password',
      fingerprint: 'fp-abc',
    });
    assert.deepEqual(rotated, { ok: true });

    // Overwrite with a different fingerprint is rejected
    const clobber = await saveWorkspaceWrappedKey(workspace.id, {
      wrappedWmk: 'evil-cipher',
      salt: 'salt-3',
      iv: 'iv-3',
      iterations: 600_000,
      kind: 'password',
      fingerprint: 'fp-different',
    });
    assert.deepEqual(clobber, { ok: false, reason: 'fingerprint_mismatch' });
  });
});

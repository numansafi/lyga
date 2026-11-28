import assert from 'node:assert/strict';
import test from 'node:test';
import {
  approveDeviceRequest,
  claimDeviceApproval,
  createDeviceApproval,
  listPendingApprovalsForWorkspace,
} from './device-approve-store.ts';

test('device-approve-store creates, scopes, approves, and claims once', async () => {
  const t0 = 1_700_000_000_000;
  const entry = await createDeviceApproval(
    {
      workspaceId: 'ws_1',
      requesterDeviceId: 'dev_new',
      requesterLabel: 'Safari on Mac',
      publicKeyB64: 'pub_abc',
      verificationCode: '4821',
    },
    t0
  );

  // Scoped to workspace
  assert.equal((await listPendingApprovalsForWorkspace('ws_other', t0 + 1000)).length, 0);
  assert.equal((await listPendingApprovalsForWorkspace('ws_1', t0 + 1000)).length, 1);

  // Wrong device or wrong workspace cannot claim
  assert.equal(await claimDeviceApproval('ws_1', entry.id, 'dev_wrong', t0 + 1000), null);
  assert.equal(await claimDeviceApproval('ws_other', entry.id, 'dev_new', t0 + 1000), null);

  // Pending claim does not delete entry
  const pending = await claimDeviceApproval('ws_1', entry.id, 'dev_new', t0 + 1000);
  assert.equal(pending?.status, 'pending');

  // Wrong workspace or self-approval cannot approve
  assert.equal(await approveDeviceRequest('ws_other', entry.id, 'dev_approver', 'cipher', t0 + 2000), false);
  assert.equal(await approveDeviceRequest('ws_1', entry.id, 'dev_new', 'cipher', t0 + 2000), false);
  assert.equal(await approveDeviceRequest('ws_1', entry.id, 'dev_approver', 'cipher', t0 + 2000), true);
  // Cannot re-approve once approved
  assert.equal(await approveDeviceRequest('ws_1', entry.id, 'dev_approver', 'cipher2', t0 + 2100), false);

  // No longer listed as pending once approved
  assert.equal((await listPendingApprovalsForWorkspace('ws_1', t0 + 2000)).length, 0);

  // Single-use claim
  const approved = await claimDeviceApproval('ws_1', entry.id, 'dev_new', t0 + 3000);
  assert.equal(approved?.status, 'approved');
  assert.equal(approved?.encryptedPayload, 'cipher');
  assert.equal(await claimDeviceApproval('ws_1', entry.id, 'dev_new', t0 + 4000), null);
});

test('device-approve-store expires requests after TTL', async () => {
  const t0 = 1_700_000_000_000;
  const entry = await createDeviceApproval(
    {
      workspaceId: 'ws_ttl',
      requesterDeviceId: 'dev_new',
      requesterLabel: 'Firefox',
      publicKeyB64: 'pub_xyz',
      verificationCode: '1234',
    },
    t0
  );

  assert.equal((await listPendingApprovalsForWorkspace('ws_ttl', entry.expiresAt + 1)).length, 0);
  assert.equal(await approveDeviceRequest('ws_ttl', entry.id, 'dev_approver', 'cipher', entry.expiresAt + 1), false);
  assert.equal(await claimDeviceApproval('ws_ttl', entry.id, 'dev_new', entry.expiresAt + 1), null);
});

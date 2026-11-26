import assert from 'node:assert/strict';
import test from 'node:test';
import {
  approveQrLoginChallenge,
  createQrLoginChallenge,
  pollQrLoginChallenge,
} from './qr-login-store.ts';

test('qr-login-store creates, approves, and claims once', async () => {
  const t0 = 1_700_000_000_000;
  const { id, secret } = await createQrLoginChallenge(t0);

  assert.deepEqual(await pollQrLoginChallenge(id, secret, t0 + 1000), { status: 'pending' });
  assert.deepEqual(await pollQrLoginChallenge(id, 'wrong-secret', t0 + 1000), {
    status: 'expired',
  });

  assert.equal(await approveQrLoginChallenge(id, 'ABCD1234', 'enc-wmk-blob', t0 + 2000), true);

  assert.deepEqual(await pollQrLoginChallenge(id, secret, t0 + 3000), {
    status: 'approved',
    pairCode: 'ABCD1234',
    encryptedWmk: 'enc-wmk-blob',
  });

  // One-time claim: second poll returns expired
  assert.deepEqual(await pollQrLoginChallenge(id, secret, t0 + 4000), { status: 'expired' });
});

test('qr-login-store expires challenges after TTL', async () => {
  const t0 = 1_700_000_000_000;
  const { id, secret, expiresAt } = await createQrLoginChallenge(t0);
  assert.equal(await approveQrLoginChallenge(id, 'ABCD1234', 'enc', expiresAt + 1), false);
  assert.deepEqual(await pollQrLoginChallenge(id, secret, expiresAt + 1), { status: 'expired' });
});

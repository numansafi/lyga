import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEphemeralQrKey,
  decryptWmkFromQr,
  encryptWmkForQr,
} from './qr-crypto.ts';

test('qr-crypto round-trips workspace key and rejects wrong key or tampered payload', async () => {
  const key1 = createEphemeralQrKey();
  const key2 = createEphemeralQrKey();
  const sampleWmk = 'dGhpcy1pcy1hLTMyLWJ5dGUtdGVzdC13bWsta2V5LTAx';

  const encrypted = await encryptWmkForQr(sampleWmk, key1);
  const decrypted = await decryptWmkFromQr(encrypted, key1);
  assert.equal(decrypted, sampleWmk);

  await assert.rejects(() => decryptWmkFromQr(encrypted, key2));
  await assert.rejects(() => decryptWmkFromQr('short', key1));
});

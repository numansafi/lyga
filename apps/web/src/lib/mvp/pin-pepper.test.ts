import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PIN_PEPPER_UNLOCK_MAX_ATTEMPTS,
  PIN_PEPPER_WINDOW_MS,
  consumePinPepperAttempt,
  derivePinPepper,
} from './pin-pepper.ts';

test('derivePinPepper is deterministic and scoped to workspace + pinHash', () => {
  const a1 = derivePinPepper('ws_1', 'hash_abc');
  const a2 = derivePinPepper('ws_1', 'hash_abc');
  const b = derivePinPepper('ws_2', 'hash_abc');
  const c = derivePinPepper('ws_1', 'hash_xyz');

  assert.equal(a1, a2);
  assert.notEqual(a1, b);
  assert.notEqual(a1, c);
  assert.ok(a1.length >= 32);
});

test('consumePinPepperAttempt enforces 5 unlock attempts per 15-minute window', async () => {
  const t0 = 1_700_000_000_000;
  const ws = 'ws_rate_test';

  for (let i = 0; i < PIN_PEPPER_UNLOCK_MAX_ATTEMPTS; i++) {
    const res = await consumePinPepperAttempt(ws, 'unlock', t0 + i * 1000);
    assert.equal(res.allowed, true);
  }

  const blocked = await consumePinPepperAttempt(ws, 'unlock', t0 + 10_000);
  assert.equal(blocked.allowed, false);
  if (!blocked.allowed) {
    assert.ok(blocked.retryAfterSec > 0);
  }

  // Setup mode has its own bucket and window resets after 15 minutes
  assert.equal((await consumePinPepperAttempt(ws, 'setup', t0 + 10_000)).allowed, true);
  assert.equal(
    (await consumePinPepperAttempt(ws, 'unlock', t0 + PIN_PEPPER_WINDOW_MS + 1)).allowed,
    true
  );
});

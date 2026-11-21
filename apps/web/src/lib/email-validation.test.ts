import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateWaitlistEmail } from './email-validation.ts';

describe('validateWaitlistEmail', () => {
  it('accepts real email addresses and normalizes casing/whitespace', () => {
    const res = validateWaitlistEmail('  Numan.Creator@gmail.com  ');
    assert.equal(res.valid, true);
    assert.equal(res.normalized, 'numan.creator@gmail.com');

    assert.equal(validateWaitlistEmail('alex@me.com').valid, true);
    assert.equal(validateWaitlistEmail('studio+lyga@hey.com').valid, true);
  });

  it('rejects malformed email addresses', () => {
    for (const bad of ['', 'not-an-email', 'a@b', 'user..name@gmail.com', 'user@a.co', 'user@domain.123']) {
      assert.equal(validateWaitlistEmail(bad).valid, false, `Expected ${bad} to be invalid`);
    }
  });

  it('rejects test, placeholder, random, and disposable email addresses', () => {
    const blocked = [
      'user@example.com',
      'user@test.com',
      'test@gmail.com',
      'asdf@outlook.com',
      'aaaa@gmail.com',
      '12345@yahoo.com',
      'creator@mailinator.com',
      'creator@yopmail.com',
      'dev@company.test',
      'dev@app.local',
    ];

    for (const email of blocked) {
      const res = validateWaitlistEmail(email);
      assert.equal(res.valid, false, `Expected ${email} to be rejected`);
      assert.match(res.error ?? '', /real email/i);
    }
  });
});

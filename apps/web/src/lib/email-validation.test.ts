import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateAuthEmail, validateWaitlistEmail } from './email-validation.ts';

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

  it('catches common domain and TLD typos like .con or gmial.com', () => {
    const liveTypo = validateWaitlistEmail('numansafi@live.con');
    assert.equal(liveTypo.valid, false);
    assert.equal(liveTypo.error, 'Did you mean numansafi@live.com?');

    const gmailTypo = validateWaitlistEmail('alex@gmial.com');
    assert.equal(gmailTypo.valid, false);
    assert.equal(gmailTypo.error, 'Did you mean alex@gmail.com?');
  });
});

describe('validateAuthEmail', () => {
  it('allows valid corporate and short-domain emails while still catching typos', () => {
    assert.equal(validateAuthEmail('admin@company.com').valid, true);
    assert.equal(validateAuthEmail('user@x.com').valid, true);
    assert.equal(validateAuthEmail('alex@proton.com').valid, true);

    const typo = validateAuthEmail('numansafi@live.con');
    assert.equal(typo.valid, false);
    assert.equal(typo.error, 'Did you mean numansafi@live.com?');
  });
});

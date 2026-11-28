import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateAuthEmail } from './email-validation.ts';

describe('validateAuthEmail', () => {
  it('accepts valid personal and corporate emails and normalizes casing/whitespace', () => {
    const res = validateAuthEmail('  Numan.Creator@gmail.com  ');
    assert.equal(res.valid, true);
    assert.equal(res.normalized, 'numan.creator@gmail.com');

    assert.equal(validateAuthEmail('admin@company.com').valid, true);
    assert.equal(validateAuthEmail('user@x.com').valid, true);
    assert.equal(validateAuthEmail('alex@proton.com').valid, true);
  });

  it('rejects malformed and reserved-TLD emails', () => {
    for (const bad of ['', 'not-an-email', 'a@b', 'user..name@gmail.com', 'dev@company.test', 'dev@app.local']) {
      assert.equal(validateAuthEmail(bad).valid, false, `Expected ${bad} to be invalid`);
    }
  });

  it('catches common domain and TLD typos', () => {
    const typo = validateAuthEmail('numansafi@live.con');
    assert.equal(typo.valid, false);
    assert.equal(typo.error, 'Did you mean numansafi@live.com?');

    const gmailTypo = validateAuthEmail('alex@gmial.com');
    assert.equal(gmailTypo.valid, false);
    assert.equal(gmailTypo.error, 'Did you mean alex@gmail.com?');
  });
});

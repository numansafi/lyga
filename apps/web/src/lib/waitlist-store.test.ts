import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

let tempDir = '';

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'lyga-waitlist-test-'));
  process.env.LYGA_WAITLIST_DIR = tempDir;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

after(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

describe('waitlist-store', () => {
  it('normalizes email, upserts plan, and preserves feedback fields on partial updates', async () => {
    const { saveWaitlistSignup, updateWaitlistFeedback } = await import('./waitlist-store.ts');

    const created = await saveWaitlistSignup('  Creator@Example.COM ', 'free');
    assert.equal(created.email, 'creator@example.com');
    assert.equal(created.plan, 'free');

    const upgraded = await saveWaitlistSignup('creator@example.com', 'pro_founder');
    assert.equal(upgraded.plan, 'pro_founder');

    await updateWaitlistFeedback('creator@example.com', 'iPhone + Windows', undefined);
    await updateWaitlistFeedback('creator@example.com', undefined, '  4K MOV clip  ');

    const raw = await readFile(path.join(tempDir, 'waitlist.json'), 'utf8');
    const entries = JSON.parse(raw) as Array<{
      email: string;
      plan: string;
      device_combo: string | null;
      pain_note: string | null;
    }>;

    assert.equal(entries.length, 1);
    assert.equal(entries[0].email, 'creator@example.com');
    assert.equal(entries[0].plan, 'pro_founder');
    assert.equal(entries[0].device_combo, 'iPhone + Windows');
    assert.equal(entries[0].pain_note, '4K MOV clip');
  });

  it('throws in production when Supabase env vars are missing unless LYGA_LOCAL_WAITLIST=true', async () => {
    const { saveWaitlistSignup } = await import('./waitlist-store.ts');
    const prevEnv = process.env.NODE_ENV;
    const prevLocal = process.env.LYGA_LOCAL_WAITLIST;

    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      delete process.env.LYGA_LOCAL_WAITLIST;
      await assert.rejects(
        () => saveWaitlistSignup('prod@example.com', 'free'),
        /Supabase environment variables are required in production/
      );
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = prevEnv;
      process.env.LYGA_LOCAL_WAITLIST = prevLocal;
    }
  });
});

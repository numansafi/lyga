import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createJsonFileStore } from './local-json-store.ts';

let tempDir = '';

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'lyga-json-store-test-'));
  process.env.LYGA_TEST_JSON_DIR = tempDir;
});

after(async () => {
  delete process.env.LYGA_TEST_JSON_DIR;
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

describe('local-json-store', () => {
  it('returns defaultValue when missing and serializes concurrent writes', async () => {
    const store = createJsonFileStore<{ count: number }>({
      filename: 'counter.json',
      envDirVar: 'LYGA_TEST_JSON_DIR',
      defaultValue: () => ({ count: 0 }),
    });

    assert.deepEqual(await store.read(), { count: 0 });

    await Promise.all(
      Array.from({ length: 10 }, () =>
        store.withLock(async () => {
          const cur = await store.read();
          await store.write({ count: cur.count + 1 });
        })
      )
    );

    assert.deepEqual(await store.read(), { count: 10 });
  });
});

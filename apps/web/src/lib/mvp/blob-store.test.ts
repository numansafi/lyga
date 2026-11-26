import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

describe('mvp blob-store', () => {
  it('validates blob keys, prevents overwrites, and reads/deletes local blobs', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'lyga-blobs-'));
    process.env.LYGA_MVP_DIR = tmpDir;

    try {
      const { assertSafeBlobKey, saveLocalBlob, readLocalBlob, deleteBlob } = await import(
        './blob-store.ts'
      );

      assert.throws(() => assertSafeBlobKey('../escape'));
      assert.throws(() => assertSafeBlobKey('short'));
      assertSafeBlobKey('ws_valid_blob_key_1234');

      const payload = new Uint8Array([1, 2, 3, 4, 5]);
      await saveLocalBlob('ws_valid_blob_key_1234', payload);

      const loaded = await readLocalBlob('ws_valid_blob_key_1234');
      assert.deepEqual(new Uint8Array(loaded!), payload);

      await assert.rejects(() => saveLocalBlob('ws_valid_blob_key_1234', payload));

      await deleteBlob('ws_valid_blob_key_1234');
      assert.equal(await readLocalBlob('ws_valid_blob_key_1234'), null);
    } finally {
      delete process.env.LYGA_MVP_DIR;
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

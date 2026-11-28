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

  it('supports local multipart upload, list, complete, abort, and range reads', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'lyga-mp-blobs-'));
    process.env.LYGA_MVP_DIR = tmpDir;

    try {
      const {
        createMultipartUpload,
        createMultipartPartUrls,
        saveLocalMultipartPart,
        listUploadedParts,
        completeMultipartUpload,
        abortMultipartUpload,
        readLocalBlob,
        readLocalBlobRange,
      } = await import('./blob-store.ts');

      const blobKey = 'ws_multipart_test_key_1';
      const { uploadId, mode } = await createMultipartUpload(blobKey);
      assert.equal(mode, 'local');

      const { urls } = await createMultipartPartUrls(blobKey, uploadId, [1, 2]);
      assert.equal(urls.length, 2);

      const part1 = new Uint8Array([10, 20, 30, 40]);
      const part2 = new Uint8Array([50, 60, 70]);
      await saveLocalMultipartPart(uploadId, 1, part1);
      await saveLocalMultipartPart(uploadId, 2, part2);

      const listed = await listUploadedParts(blobKey, uploadId);
      assert.deepEqual(
        listed.map((p) => ({ partNumber: p.partNumber, size: p.size })),
        [
          { partNumber: 1, size: 4 },
          { partNumber: 2, size: 3 },
        ]
      );

      const { sizeBytes } = await completeMultipartUpload(blobKey, uploadId);
      assert.equal(sizeBytes, 7);

      const full = await readLocalBlob(blobKey);
      assert.deepEqual(new Uint8Array(full!), new Uint8Array([10, 20, 30, 40, 50, 60, 70]));

      const range = await readLocalBlobRange(blobKey, 2, 5);
      assert.ok(range);
      assert.equal(range.totalSize, 7);
      assert.equal(range.start, 2);
      assert.equal(range.end, 5);
      assert.deepEqual(new Uint8Array(range.chunk), new Uint8Array([30, 40, 50, 60]));

      // Abort cleanup test
      const aborted = await createMultipartUpload('ws_multipart_abort_key');
      await saveLocalMultipartPart(aborted.uploadId, 1, part1);
      await abortMultipartUpload('ws_multipart_abort_key', aborted.uploadId);
      assert.deepEqual(await listUploadedParts('ws_multipart_abort_key', aborted.uploadId), []);
    } finally {
      delete process.env.LYGA_MVP_DIR;
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

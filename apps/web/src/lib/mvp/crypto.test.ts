import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('mvp webcrypto E2EE', () => {
  it('encrypts and decrypts strings and chunked files with AES-GCM', async () => {
    const {
      generateWorkspaceKey,
      importWorkspaceKey,
      encryptString,
      decryptString,
      encryptFileChunked,
      decryptFileChunked,
      classifyTextKind,
      classifyFileKind,
    } = await import('./crypto.ts');

    const wmk = generateWorkspaceKey();
    const key = await importWorkspaceKey(wmk);

    const encrypted = await encryptString(key, 'Hello from iPhone 4K');
    assert.notEqual(encrypted, 'Hello from iPhone 4K');
    assert.equal(await decryptString(key, encrypted), 'Hello from iPhone 4K');

    const file = new File(['abc123-lyga-video-bytes'], 'clip.mov', { type: 'video/quicktime' });
    const { blob, chunkCount } = await encryptFileChunked(key, file);
    assert.equal(chunkCount, 1);

    const decryptedBlob = await decryptFileChunked(key, await blob.arrayBuffer(), 'video/quicktime');
    assert.equal(await decryptedBlob.text(), 'abc123-lyga-video-bytes');

    assert.equal(classifyTextKind('https://lyga.app/test'), 'link');
    assert.equal(classifyTextKind('const x = 1;\nexport default x;'), 'code');
    assert.equal(classifyTextKind('quick note'), 'text');
    assert.equal(classifyFileKind('video/quicktime', 'clip.mov'), 'media');
    assert.equal(classifyFileKind('application/pdf', 'doc.pdf'), 'file');

    await assert.rejects(() => decryptFileChunked(key, new ArrayBuffer(0)));
    await assert.rejects(() => decryptFileChunked(key, new Uint8Array([0, 0, 0, 20, 1, 2]).buffer));
    await assert.rejects(() => decryptFileChunked(key, new Uint8Array([1, 2, 3]).buffer));
  });

  it('derives per-file HKDF subkeys and authenticates format-v2 frames against swap/reorder/truncation', async () => {
    const {
      generateWorkspaceKey,
      importWorkspaceHkdfKey,
      deriveFileKey,
      encryptFileFrameV2,
      decryptFileFrameV2,
    } = await import('./crypto.ts');

    const wmk = generateWorkspaceKey();
    const hkdfKey = await importWorkspaceHkdfKey(wmk);
    const fileAKey = await deriveFileKey(hkdfKey, 'ws_file_a_0001');
    const fileBKey = await deriveFileKey(hkdfKey, 'ws_file_b_0002');

    const plain0 = new TextEncoder().encode('frame-zero-payload');
    const plain1 = new TextEncoder().encode('frame-one-payload');
    const frame0 = await encryptFileFrameV2(fileAKey, plain0, 0, 2);
    const frame1 = await encryptFileFrameV2(fileAKey, plain1, 1, 2);

    assert.deepEqual(await decryptFileFrameV2(fileAKey, frame0, 0, 2), plain0);
    assert.deepEqual(await decryptFileFrameV2(fileAKey, frame1, 1, 2), plain1);

    // Rejects reordered chunk index
    await assert.rejects(() => decryptFileFrameV2(fileAKey, frame1, 0, 2));
    // Rejects wrong totalChunks (truncation attack)
    await assert.rejects(() => decryptFileFrameV2(fileAKey, frame0, 0, 1));
    // Rejects cross-file chunk swap
    await assert.rejects(() => decryptFileFrameV2(fileBKey, frame0, 0, 2));
    // Rejects truncated frame bytes
    await assert.rejects(() => decryptFileFrameV2(fileAKey, frame0.subarray(0, frame0.length - 1), 0, 2));
  });
});

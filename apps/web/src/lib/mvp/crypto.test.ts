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
});

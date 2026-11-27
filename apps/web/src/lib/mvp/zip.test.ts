import assert from 'node:assert/strict';
import test from 'node:test';
import { buildZipArchive } from './zip.ts';

test('buildZipArchive produces valid PKZIP headers and deduplicates names', () => {
  const enc = new TextEncoder();
  const zip = buildZipArchive([
    { name: 'note.txt', data: enc.encode('hello') },
    { name: 'note.txt', data: enc.encode('world') },
  ]);

  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  // Local file header signature PK\x03\x04
  assert.equal(view.getUint32(0, true), 0x04034b50);
  // End of central directory signature PK\x05\x06 at tail
  assert.equal(view.getUint32(zip.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(zip.length - 12, true), 2);

  const text = new TextDecoder().decode(zip);
  assert.match(text, /note\.txt/);
  assert.match(text, /note \(2\)\.txt/);
});

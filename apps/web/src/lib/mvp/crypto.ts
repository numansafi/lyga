import { CHUNK_SIZE_BYTES, type FeedItemKind } from './constants.ts';

export interface DecryptedItemMeta {
  title: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  senderDeviceId?: string;
  senderLabel?: string;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function generateWorkspaceKey(): string {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  return toBase64Url(raw);
}

export async function importWorkspaceKey(wmkBase64Url: string): Promise<CryptoKey> {
  const raw = fromBase64Url(wmkBase64Url);
  if (raw.byteLength !== 32) {
    throw new Error('Invalid workspace key length.');
  }
  return crypto.subtle.importKey('raw', toArrayBuffer(raw), { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptString(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(encoded)
  );
  const out = new Uint8Array(iv.byteLength + cipher.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(cipher), iv.byteLength);
  return toBase64Url(out);
}

export async function decryptString(key: CryptoKey, payload: string): Promise<string> {
  const bytes = fromBase64Url(payload);
  if (bytes.byteLength < 13) {
    throw new Error('Corrupt encrypted payload.');
  }
  const iv = bytes.slice(0, 12);
  const cipher = bytes.slice(12);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(cipher)
  );
  return new TextDecoder().decode(plain);
}

/**
 * Encrypts a File in 5 MB chunks. Each chunk is framed as:
 * [4-byte uint32 BE encryptedLen][12-byte IV][AES-GCM ciphertext]
 */
export async function encryptFileChunked(
  key: CryptoKey,
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ blob: Blob; chunkCount: number }> {
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE_BYTES));
  const parts: BlobPart[] = [];

  for (let i = 0; i < totalChunks; i += 1) {
    const start = i * CHUNK_SIZE_BYTES;
    const end = Math.min(file.size, start + CHUNK_SIZE_BYTES);
    const plainBuf = await file.slice(start, end).arrayBuffer();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipherBuf = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      key,
      plainBuf
    );

    const frameLen = 12 + cipherBuf.byteLength;
    const header = new Uint8Array(4);
    new DataView(header.buffer).setUint32(0, frameLen, false);

    parts.push(header, iv, new Uint8Array(cipherBuf));
    onProgress?.(Math.round(((i + 1) / totalChunks) * 100));
  }

  return {
    blob: new Blob(parts, { type: 'application/octet-stream' }),
    chunkCount: totalChunks,
  };
}

export async function decryptFileChunked(
  key: CryptoKey,
  encryptedBuffer: ArrayBuffer,
  mimeType = 'application/octet-stream'
): Promise<Blob> {
  const view = new DataView(encryptedBuffer);
  const bytes = new Uint8Array(encryptedBuffer);
  const plainParts: BlobPart[] = [];
  let offset = 0;

  while (offset + 4 <= bytes.byteLength) {
    const frameLen = view.getUint32(offset, false);
    offset += 4;
    if (frameLen < 12 || offset + frameLen > bytes.byteLength) {
      throw new Error('Corrupt encrypted file chunk.');
    }
    const iv = bytes.slice(offset, offset + 12);
    const cipher = bytes.slice(offset + 12, offset + frameLen);
    offset += frameLen;

    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(cipher)
    );
    plainParts.push(new Uint8Array(plainBuf));
  }

  if (bytes.byteLength === 0 || offset !== bytes.byteLength) {
    throw new Error('Corrupt encrypted file chunk.');
  }

  return new Blob(plainParts, { type: mimeType });
}

export function classifyTextKind(text: string): FeedItemKind {
  const trimmed = text.trim();
  if (/^https?:\/\/\S+$/i.test(trimmed)) {
    return 'link';
  }
  const hasNewline = trimmed.includes('\n');
  const looksLikeCode =
    /(^|\s)(const |let |var |function |import |export |class |def |SELECT |CREATE TABLE|=>|<\/?[a-z])/m.test(
      trimmed
    );
  if (hasNewline && looksLikeCode) {
    return 'code';
  }
  return 'text';
}

export function classifyFileKind(mimeType: string, fileName: string): 'media' | 'file' {
  if (mimeType.startsWith('image/') || mimeType.startsWith('video/')) {
    return 'media';
  }
  if (/\.(mov|mp4|m4v|webm|heic|heif|jpg|jpeg|png|gif|webp|raw|dng|cr2|arw)$/i.test(fileName)) {
    return 'media';
  }
  return 'file';
}

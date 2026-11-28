import { CHUNK_SIZE_BYTES, type FeedItemKind } from './constants.ts';

export interface DecryptedItemMeta {
  title: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  senderDeviceId?: string;
  senderLabel?: string;
  formatVersion?: 1 | 2;
  totalChunks?: number;
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

/** Import the raw 256-bit workspace key as an HKDF base key for per-file v2 subkey derivation. */
export async function importWorkspaceHkdfKey(wmkBase64Url: string): Promise<CryptoKey> {
  const raw = fromBase64Url(wmkBase64Url);
  if (raw.byteLength !== 32) {
    throw new Error('Invalid workspace key length.');
  }
  return crypto.subtle.importKey('raw', toArrayBuffer(raw), { name: 'HKDF' }, false, ['deriveKey']);
}

/** Derive a unique AES-GCM-256 key per blobKey so chunks cannot be swapped across files. */
export async function deriveFileKey(hkdfKey: CryptoKey, blobKey: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: toArrayBuffer(enc.encode(`lyga-v2:${blobKey}`)),
      info: toArrayBuffer(enc.encode('file-aes-gcm')),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
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

function buildFrameAad(chunkIndex: number, totalChunks: number): ArrayBuffer {
  return toArrayBuffer(new TextEncoder().encode(`v2:${chunkIndex}:${totalChunks}`));
}

/**
 * Encrypts a single format-v2 frame (1 frame = 1 R2 part) with per-file HKDF key and AAD
 * binding chunkIndex and totalChunks.
 */
export async function encryptFileFrameV2(
  fileKey: CryptoKey,
  plainBytes: ArrayBuffer | Uint8Array,
  chunkIndex: number,
  totalChunks: number
): Promise<Uint8Array> {
  const plainBuf = plainBytes instanceof Uint8Array ? toArrayBuffer(plainBytes) : plainBytes;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
      additionalData: buildFrameAad(chunkIndex, totalChunks),
    },
    fileKey,
    plainBuf
  );

  const frameLen = 12 + cipherBuf.byteLength;
  const out = new Uint8Array(4 + frameLen);
  new DataView(out.buffer).setUint32(0, frameLen, false);
  out.set(iv, 4);
  out.set(new Uint8Array(cipherBuf), 16);
  return out;
}

/**
 * Decrypts and authenticates a single format-v2 frame, rejecting reordered, cross-file,
 * or truncated frames.
 */
export async function decryptFileFrameV2(
  fileKey: CryptoKey,
  frameBytes: Uint8Array,
  chunkIndex: number,
  totalChunks: number
): Promise<Uint8Array> {
  if (frameBytes.byteLength < 4 + 12 + 16) {
    throw new Error('Corrupt or truncated encrypted frame.');
  }
  const frameLen = new DataView(
    frameBytes.buffer,
    frameBytes.byteOffset,
    frameBytes.byteLength
  ).getUint32(0, false);
  if (frameLen < 28 || 4 + frameLen !== frameBytes.byteLength) {
    throw new Error('Corrupt encrypted frame length.');
  }
  const iv = frameBytes.subarray(4, 16);
  const cipher = frameBytes.subarray(16);
  const plainBuf = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
      additionalData: buildFrameAad(chunkIndex, totalChunks),
    },
    fileKey,
    toArrayBuffer(cipher)
  );
  return new Uint8Array(plainBuf);
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

export type WrappedKeyKind = 'password';

export const WMK_PBKDF2_ITERATIONS = 600_000;

export interface WrappedWorkspaceKey {
  wrappedWmk: string;
  salt: string;
  iv: string;
  iterations: number;
  kind: WrappedKeyKind;
  fingerprint: string;
}

/** One-way SHA-256 fingerprint proving possession of `wmk` without revealing it. */
export async function computeWmkFingerprint(wmkBase64Url: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    toArrayBuffer(new TextEncoder().encode(`lyga-wmk-fp:${wmkBase64Url}`))
  );
  return toBase64Url(new Uint8Array(digest));
}

async function deriveWrappingKey(
  secret: string,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(new TextEncoder().encode(secret)),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function buildWrapAad(workspaceId: string): ArrayBuffer {
  return toArrayBuffer(new TextEncoder().encode(`lyga-wmk-v1:${workspaceId}`));
}

/** Encrypts `wmk` in the browser with a PBKDF2-derived key bound to `workspaceId`. */
export async function wrapWorkspaceKey(
  wmkBase64Url: string,
  secret: string,
  workspaceId: string,
  kind: WrappedKeyKind,
  iterations = WMK_PBKDF2_ITERATIONS
): Promise<WrappedWorkspaceKey> {
  if (!secret || secret.length < 6) {
    throw new Error('Secret must be at least 6 characters.');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrappingKey = await deriveWrappingKey(secret, salt, iterations);
  const cipherBuf = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
      additionalData: buildWrapAad(workspaceId),
    },
    wrappingKey,
    toArrayBuffer(new TextEncoder().encode(wmkBase64Url))
  );
  const fingerprint = await computeWmkFingerprint(wmkBase64Url);
  return {
    wrappedWmk: toBase64Url(new Uint8Array(cipherBuf)),
    salt: toBase64Url(salt),
    iv: toBase64Url(iv),
    iterations,
    kind,
    fingerprint,
  };
}

/** Decrypts a wrapped workspace key in the browser and verifies its fingerprint. */
export async function unwrapWorkspaceKey(
  wrapped: Omit<WrappedWorkspaceKey, 'kind'> & { kind?: WrappedKeyKind },
  secret: string,
  workspaceId: string
): Promise<string> {
  const salt = fromBase64Url(wrapped.salt);
  const iv = fromBase64Url(wrapped.iv);
  const cipher = fromBase64Url(wrapped.wrappedWmk);
  const wrappingKey = await deriveWrappingKey(secret, salt, wrapped.iterations);
  const plainBuf = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
      additionalData: buildWrapAad(workspaceId),
    },
    wrappingKey,
    toArrayBuffer(cipher)
  );
  const wmk = new TextDecoder().decode(plainBuf);
  if (wrapped.fingerprint) {
    const actualFp = await computeWmkFingerprint(wmk);
    if (actualFp !== wrapped.fingerprint) {
      throw new Error('Workspace key fingerprint mismatch.');
    }
  }
  return wmk;
}

/** Ephemeral ECDH P-256 keypair for camera-free 1-Tap Device Approval. */
export async function generateApprovalKeyPair(): Promise<{
  publicKeyB64: string;
  privateKey: CryptoKey;
}> {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );
  const spki = await crypto.subtle.exportKey('spki', pair.publicKey);
  return {
    publicKeyB64: toBase64Url(new Uint8Array(spki)),
    privateKey: pair.privateKey,
  };
}

/** Deterministic 4-digit match code derived from approval ID and public key. */
export async function deriveShortVerificationCode(
  publicKeyB64: string,
  approvalId: string
): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    toArrayBuffer(new TextEncoder().encode(`${approvalId}:${publicKeyB64}`))
  );
  const view = new DataView(digest);
  const code = view.getUint32(0, false) % 10_000;
  return String(code).padStart(4, '0');
}

export async function encryptWmkForPublicKey(
  wmkBase64Url: string,
  recipientPublicKeyB64: string,
  approvalId: string
): Promise<string> {
  const recipientPub = await crypto.subtle.importKey(
    'spki',
    toArrayBuffer(fromBase64Url(recipientPublicKeyB64)),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );
  const sharedAes = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: recipientPub },
    ephemeral.privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aad = toArrayBuffer(new TextEncoder().encode(`lyga-approve-v1:${approvalId}`));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv), additionalData: aad },
    sharedAes,
    toArrayBuffer(new TextEncoder().encode(wmkBase64Url))
  );
  const ephemSpki = await crypto.subtle.exportKey('spki', ephemeral.publicKey);
  return JSON.stringify({
    v: 1,
    epk: toBase64Url(new Uint8Array(ephemSpki)),
    iv: toBase64Url(iv),
    c: toBase64Url(new Uint8Array(cipherBuf)),
  });
}

export async function decryptWmkFromApproval(
  payload: string,
  recipientPrivateKey: CryptoKey,
  approvalId: string
): Promise<string> {
  const parsed = JSON.parse(payload) as { v?: number; epk?: string; iv?: string; c?: string };
  if (parsed.v !== 1 || !parsed.epk || !parsed.iv || !parsed.c) {
    throw new Error('Invalid approval payload.');
  }
  const senderPub = await crypto.subtle.importKey(
    'spki',
    toArrayBuffer(fromBase64Url(parsed.epk)),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  const sharedAes = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: senderPub },
    recipientPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const aad = toArrayBuffer(new TextEncoder().encode(`lyga-approve-v1:${approvalId}`));
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(fromBase64Url(parsed.iv)), additionalData: aad },
    sharedAes,
    toArrayBuffer(fromBase64Url(parsed.c))
  );
  return new TextDecoder().decode(plainBuf);
}

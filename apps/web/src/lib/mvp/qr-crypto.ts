function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function createEphemeralQrKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

async function importAesKey(keyB64: string, usage: KeyUsage[]): Promise<CryptoKey> {
  const raw = fromBase64Url(keyB64);
  if (raw.byteLength !== 32) {
    throw new Error('Invalid QR key length');
  }
  return crypto.subtle.importKey(
    'raw',
    raw.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    usage
  );
}

export async function encryptWmkForQr(wmk: string, keyB64: string): Promise<string> {
  const key = await importAesKey(keyB64, ['encrypt']);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const encoded = new TextEncoder().encode(wmk);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  );
  const combined = new Uint8Array(iv.length + cipher.length);
  combined.set(iv, 0);
  combined.set(cipher, iv.length);
  return toBase64Url(combined);
}

export async function decryptWmkFromQr(encryptedB64: string, keyB64: string): Promise<string> {
  const combined = fromBase64Url(encryptedB64);
  if (combined.byteLength < 13) {
    throw new Error('Invalid encrypted QR payload');
  }
  const iv = combined.slice(0, 12);
  const cipher = combined.slice(12);
  const key = await importAesKey(keyB64, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(plain);
}

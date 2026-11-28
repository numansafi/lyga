'use client';

import { decryptFileChunked } from './crypto';
import { getFileExtension, type DecryptedFeedItem } from './feed-selectors';
import { downloadV2Streamed } from './multipart-client';
import { buildZipArchive, type ZipEntryInput } from './zip';

export async function fetchDecryptedPlainBlob(
  cryptoKey: CryptoKey,
  item: DecryptedFeedItem,
  hkdfKey?: CryptoKey | null
): Promise<Blob | null> {
  if (!item.raw.blob_key) return null;
  if (item.meta.formatVersion === 2 && hkdfKey) {
    const res = await downloadV2Streamed(hkdfKey, item, { saveToDisk: false });
    return res.streamedToDisk ? null : res.blob;
  }
  const urlRes = await fetch(`/api/mvp/download-url?id=${encodeURIComponent(item.raw.id)}`);
  if (!urlRes.ok) return null;
  const { downloadUrl } = (await urlRes.json()) as { downloadUrl: string };
  const blobRes = await fetch(downloadUrl);
  if (!blobRes.ok) return null;
  const encBuf = await blobRes.arrayBuffer();
  return decryptFileChunked(
    cryptoKey,
    encBuf,
    item.meta.mimeType || 'application/octet-stream'
  );
}

export async function convertHeicIfNeeded(blob: Blob, item: DecryptedFeedItem): Promise<Blob> {
  const ext = getFileExtension(item.meta.fileName || item.meta.title);
  const mime = (item.meta.mimeType ?? '').toLowerCase();
  if (ext !== 'heic' && ext !== 'heif' && mime !== 'image/heic' && mime !== 'image/heif') {
    return blob;
  }
  try {
    const heic2any = (await import('heic2any')).default;
    const converted = await heic2any({
      blob,
      toType: 'image/jpeg',
      quality: 0.9,
    });
    return Array.isArray(converted) ? converted[0] : converted;
  } catch {
    // Fall back to raw blob (works natively on Safari)
    return blob;
  }
}

export async function exportItemsToZip(
  cryptoKey: CryptoKey,
  items: DecryptedFeedItem[],
  hkdfKey?: CryptoKey | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const entries: ZipEntryInput[] = [];
  const notesLines: string[] = [];
  const enc = new TextEncoder();

  const fileEntries = await Promise.all(
    items
      .filter((item) => item.raw.kind === 'media' || item.raw.kind === 'file')
      .map(async (item): Promise<ZipEntryInput | null> => {
        const plainBlob = await fetchDecryptedPlainBlob(cryptoKey, item, hkdfKey);
        if (!plainBlob) return null;
        const buf = new Uint8Array(await plainBlob.arrayBuffer());
        return {
          name: item.meta.fileName || item.meta.title || `${item.raw.id}.bin`,
          data: buf,
        };
      })
  );

  for (const entry of fileEntries) {
    if (entry) entries.push(entry);
  }
  for (const item of items) {
    if (item.raw.kind !== 'media' && item.raw.kind !== 'file' && item.bodyText) {
      notesLines.push(
        `[${new Date(item.raw.created_at).toISOString()}] (${item.raw.kind})\n${item.bodyText}\n`
      );
    }
  }

  if (notesLines.length > 0) {
    entries.push({
      name: 'lyga-notes.txt',
      data: enc.encode(notesLines.join('\n---\n\n')),
    });
  }

  if (entries.length === 0) {
    return { ok: false, error: 'No items could be decrypted for export.' };
  }

  const zipBytes = buildZipArchive(entries);
  const blob = new Blob([zipBytes as BlobPart], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lyga-export-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { ok: true };
}

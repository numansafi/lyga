'use client';

import {
  MULTIPART_PART_PLAIN_BYTES,
  MULTIPART_PART_WIRE_BYTES,
  type FeedItemRecord,
} from './constants';
import {
  decryptFileFrameV2,
  deriveFileKey,
  encryptFileFrameV2,
  encryptString,
  type DecryptedItemMeta,
} from './crypto';
import type { DecryptedFeedItem } from './feed-selectors';

const IDB_NAME = 'lyga-multipart-resume';
const IDB_STORE = 'uploads';
const URL_BATCH_SIZE = 10;
const MAX_PART_ATTEMPTS = 4;

interface ResumeRecord {
  fingerprint: string;
  blobKey: string;
  uploadId: string;
  partsDone: number[];
  updatedAt: number;
}

function fileFingerprint(workspaceId: string, file: File): string {
  return `${workspaceId}::${file.name}::${file.size}::${file.lastModified}`;
}

function openResumeDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'fingerprint' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function getResumeRecord(fingerprint: string): Promise<ResumeRecord | null> {
  const db = await openResumeDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(fingerprint);
      req.onsuccess = () => resolve((req.result as ResumeRecord | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function putResumeRecord(record: ResumeRecord): Promise<void> {
  const db = await openResumeDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function deleteResumeRecord(fingerprint: string): Promise<void> {
  const db = await openResumeDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(fingerprint);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function putPartWithXhr(
  url: string,
  body: Uint8Array,
  onProgress: (loaded: number) => void,
  signal: AbortSignal | undefined,
  activeXhrs: Set<XMLHttpRequest>
): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false);
      return;
    }

    const xhr = new XMLHttpRequest();
    activeXhrs.add(xhr);

    const onAbort = () => {
      xhr.abort();
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        onProgress(ev.loaded);
      }
    };
    xhr.onload = () => {
      cleanup();
      resolve(xhr.status >= 200 && xhr.status < 300);
    };
    xhr.onerror = () => {
      cleanup();
      resolve(false);
    };
    xhr.onabort = () => {
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      activeXhrs.delete(xhr);
      signal?.removeEventListener('abort', onAbort);
    };

    const buffer = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
    xhr.send(new Blob([buffer], { type: 'application/octet-stream' }));
  });
}

export interface MultipartUploadCallbacks {
  onProgress: (pct: number) => void;
  signal?: AbortSignal;
}

export async function uploadFileMultipart(
  workspaceId: string,
  file: File,
  cryptoKey: CryptoKey,
  hkdfKey: CryptoKey,
  meta: DecryptedItemMeta,
  kind: 'media' | 'file',
  callbacks: MultipartUploadCallbacks
): Promise<
  | { ok: true; item: FeedItemRecord }
  | { ok: false; cancelled?: boolean; error: string }
> {
  const totalChunks = Math.max(1, Math.ceil(file.size / MULTIPART_PART_PLAIN_BYTES));
  const fingerprint = fileFingerprint(workspaceId, file);
  const v2Meta: DecryptedItemMeta = {
    ...meta,
    formatVersion: 2,
    totalChunks,
  };
  const encryptedMeta = await encryptString(cryptoKey, JSON.stringify(v2Meta));

  let blobKey = '';
  let uploadId = '';
  const urlCache = new Map<number, string>();
  const completedParts = new Set<number>();

  // Try resuming an existing upload if present in IndexedDB
  const existing = await getResumeRecord(fingerprint);
  if (existing) {
    try {
      const nextToSign = Array.from({ length: totalChunks }, (_, i) => i + 1)
        .filter((n) => !existing.partsDone.includes(n))
        .slice(0, URL_BATCH_SIZE);
      const reconcileRes = await fetch('/api/mvp/upload-multipart/parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blobKey: existing.blobKey,
          uploadId: existing.uploadId,
          partNumbers: nextToSign,
        }),
      });
      if (reconcileRes.ok) {
        const data = (await reconcileRes.json()) as {
          urls: Array<{ partNumber: number; url: string }>;
          uploadedParts: number[];
        };
        blobKey = existing.blobKey;
        uploadId = existing.uploadId;
        for (const p of data.uploadedParts) {
          completedParts.add(p);
        }
        for (const u of data.urls) {
          urlCache.set(u.partNumber, u.url);
        }
      } else {
        await deleteResumeRecord(fingerprint);
      }
    } catch {
      await deleteResumeRecord(fingerprint);
    }
  }

  if (!uploadId) {
    const initRes = await fetch('/api/mvp/upload-multipart/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sizeBytes: file.size,
        totalParts: totalChunks,
      }),
    });

    if (!initRes.ok) {
      const err = (await initRes.json().catch(() => null)) as {
        error?: string;
        code?: string;
      } | null;
      return {
        ok: false,
        error: err?.error ?? 'Unable to start multipart upload.',
      };
    }

    const initData = (await initRes.json()) as {
      blobKey: string;
      uploadId: string;
      urls: Array<{ partNumber: number; url: string }>;
    };
    blobKey = initData.blobKey;
    uploadId = initData.uploadId;
    for (const u of initData.urls) {
      urlCache.set(u.partNumber, u.url);
    }
    await putResumeRecord({
      fingerprint,
      blobKey,
      uploadId,
      partsDone: [],
      updatedAt: Date.now(),
    });
  }

  const fileKey = await deriveFileKey(hkdfKey, blobKey);
  const pendingParts = Array.from({ length: totalChunks }, (_, i) => i + 1).filter(
    (n) => !completedParts.has(n)
  );

  const inFlightBytes = new Map<number, number>();
  let completedPlainBytes = Array.from(completedParts).reduce((sum, partNum) => {
    const start = (partNum - 1) * MULTIPART_PART_PLAIN_BYTES;
    const end = Math.min(file.size, partNum * MULTIPART_PART_PLAIN_BYTES);
    return sum + Math.max(0, end - start);
  }, 0);

  const reportProgress = () => {
    let activeBytes = 0;
    for (const loaded of inFlightBytes.values()) {
      activeBytes += loaded;
    }
    const pct = Math.min(
      95,
      Math.max(1, Math.round(((completedPlainBytes + activeBytes) / file.size) * 95))
    );
    callbacks.onProgress(pct);
  };
  reportProgress();

  // Keep screen awake during active upload on mobile/supported browsers
  let wakeLock: { release: () => Promise<void> } | null = null;
  const acquireWakeLock = async () => {
    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
      };
      if (nav.wakeLock && !wakeLock) {
        wakeLock = await nav.wakeLock.request('screen');
      }
    } catch {
      // Wake Lock is optional
    }
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      void acquireWakeLock();
    }
  };
  await acquireWakeLock();
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
  }

  const activeXhrs = new Set<XMLHttpRequest>();
  let urlFetchLock: Promise<void> = Promise.resolve();

  const getPartUrl = async (partNumber: number): Promise<string | null> => {
    const cached = urlCache.get(partNumber);
    if (cached) return cached;

    const task = urlFetchLock.then(async () => {
      if (urlCache.has(partNumber)) return;
      const batch = pendingParts
        .filter((n) => n >= partNumber && !completedParts.has(n) && !urlCache.has(n))
        .slice(0, URL_BATCH_SIZE);
      if (!batch.includes(partNumber)) {
        batch.unshift(partNumber);
      }
      const res = await fetch('/api/mvp/upload-multipart/parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blobKey,
          uploadId,
          partNumbers: batch.slice(0, 25),
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        urls: Array<{ partNumber: number; url: string }>;
      };
      for (const u of data.urls) {
        urlCache.set(u.partNumber, u.url);
      }
    });
    urlFetchLock = task.catch(() => undefined);
    await task;
    return urlCache.get(partNumber) ?? null;
  };

  let nextIdx = 0;
  let failedError: string | null = null;
  const CONCURRENCY = 3;

  const runWorker = async () => {
    while (!failedError && !callbacks.signal?.aborted) {
      const idx = nextIdx++;
      if (idx >= pendingParts.length) return;
      const partNumber = pendingParts[idx];
      const chunkIndex = partNumber - 1;
      const start = chunkIndex * MULTIPART_PART_PLAIN_BYTES;
      const end = Math.min(file.size, start + MULTIPART_PART_PLAIN_BYTES);
      const plainBuf = await file.slice(start, end).arrayBuffer();
      const frame = await encryptFileFrameV2(fileKey, plainBuf, chunkIndex, totalChunks);

      let uploaded = false;
      for (let attempt = 0; attempt < MAX_PART_ATTEMPTS; attempt++) {
        if (callbacks.signal?.aborted) break;
        const url = await getPartUrl(partNumber);
        if (!url) {
          await sleep(500 * 2 ** attempt);
          continue;
        }
        inFlightBytes.set(partNumber, 0);
        const ok = await putPartWithXhr(
          url,
          frame,
          (loaded) => {
            inFlightBytes.set(partNumber, Math.min(end - start, loaded));
            reportProgress();
          },
          callbacks.signal,
          activeXhrs
        );
        if (ok) {
          uploaded = true;
          break;
        }
        urlCache.delete(partNumber);
        if (!callbacks.signal?.aborted && attempt < MAX_PART_ATTEMPTS - 1) {
          const jitter = Math.floor(Math.random() * 250);
          await sleep(500 * 2 ** attempt + jitter);
        }
      }

      inFlightBytes.delete(partNumber);
      if (!uploaded) {
        if (!callbacks.signal?.aborted) {
          failedError = `Failed to upload part ${partNumber} of ${totalChunks}.`;
        }
        return;
      }

      completedParts.add(partNumber);
      completedPlainBytes += end - start;
      reportProgress();
      void putResumeRecord({
        fingerprint,
        blobKey,
        uploadId,
        partsDone: Array.from(completedParts),
        updatedAt: Date.now(),
      });
    }
  };

  try {
    await Promise.all(Array.from({ length: CONCURRENCY }, () => runWorker()));

    if (callbacks.signal?.aborted) {
      for (const xhr of activeXhrs) {
        xhr.abort();
      }
      await fetch('/api/mvp/upload-multipart/abort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blobKey, uploadId }),
      }).catch(() => undefined);
      await deleteResumeRecord(fingerprint);
      return { ok: false, cancelled: true, error: 'Upload cancelled.' };
    }

    if (failedError) {
      return { ok: false, error: failedError };
    }

    callbacks.onProgress(96);
    const completeRes = await fetch('/api/mvp/upload-multipart/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blobKey,
        uploadId,
        kind,
        encryptedMeta,
        chunkCount: totalChunks,
      }),
    });

    if (!completeRes.ok) {
      const err = (await completeRes.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: err?.error ?? 'Failed to finalize upload.' };
    }

    const payload = (await completeRes.json()) as { item: FeedItemRecord };
    await deleteResumeRecord(fingerprint);
    callbacks.onProgress(100);
    return { ok: true, item: payload.item };
  } finally {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility);
    }
    if (wakeLock) {
      await (wakeLock as { release: () => Promise<void> }).release().catch(() => undefined);
    }
  }
}

export async function downloadV2Streamed(
  hkdfKey: CryptoKey,
  item: DecryptedFeedItem,
  options?: {
    saveToDisk?: boolean;
    onProgress?: (pct: number) => void;
  }
): Promise<{ streamedToDisk: true } | { streamedToDisk: false; blob: Blob }> {
  if (!item.raw.blob_key) {
    throw new Error('Missing blob key.');
  }

  const urlRes = await fetch(`/api/mvp/download-url?id=${encodeURIComponent(item.raw.id)}`);
  if (!urlRes.ok) {
    throw new Error('Unable to get download URL.');
  }
  const { downloadUrl } = (await urlRes.json()) as { downloadUrl: string };

  const fileKey = await deriveFileKey(hkdfKey, item.raw.blob_key);
  const totalChunks = item.meta.totalChunks ?? item.raw.chunk_count;

  const canPickFile =
    Boolean(options?.saveToDisk) &&
    typeof window !== 'undefined' &&
    'showSaveFilePicker' in window;

  if (canPickFile) {
    const picker = (
      window as unknown as {
        showSaveFilePicker: (opts?: { suggestedName?: string }) => Promise<{
          createWritable: () => Promise<{
            write: (data: Uint8Array) => Promise<void>;
            close: () => Promise<void>;
            abort: () => Promise<void>;
          }>;
        }>;
      }
    ).showSaveFilePicker;

    const handle = await picker({
      suggestedName: item.meta.fileName || 'lyga-download',
    });
    const writable = await handle.createWritable();

    try {
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * MULTIPART_PART_WIRE_BYTES;
        const end = (chunkIndex + 1) * MULTIPART_PART_WIRE_BYTES - 1;
        const res = await fetch(downloadUrl, {
          headers: { Range: `bytes=${start}-${end}` },
        });
        if (res.status !== 206 && !(res.status === 200 && totalChunks === 1)) {
          throw new Error(`Failed to fetch chunk ${chunkIndex + 1}.`);
        }
        const frameBytes = new Uint8Array(await res.arrayBuffer());
        const plain = await decryptFileFrameV2(fileKey, frameBytes, chunkIndex, totalChunks);
        await writable.write(plain);
        options?.onProgress?.(Math.round(((chunkIndex + 1) / totalChunks) * 100));
      }
      await writable.close();
      return { streamedToDisk: true };
    } catch (err) {
      await writable.abort().catch(() => undefined);
      throw err;
    }
  }

  const parts: BlobPart[] = [];
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * MULTIPART_PART_WIRE_BYTES;
    const end = (chunkIndex + 1) * MULTIPART_PART_WIRE_BYTES - 1;
    const res = await fetch(downloadUrl, {
      headers: { Range: `bytes=${start}-${end}` },
    });
    if (res.status !== 206 && !(res.status === 200 && totalChunks === 1)) {
      throw new Error(`Failed to fetch chunk ${chunkIndex + 1}.`);
    }
    const frameBytes = new Uint8Array(await res.arrayBuffer());
    const plain = await decryptFileFrameV2(fileKey, frameBytes, chunkIndex, totalChunks);
    const copy = new Uint8Array(plain.byteLength);
    copy.set(plain);
    parts.push(copy);
    options?.onProgress?.(Math.round(((chunkIndex + 1) / totalChunks) * 100));
  }

  return {
    streamedToDisk: false,
    blob: new Blob(parts, {
      type: item.meta.mimeType || 'application/octet-stream',
    }),
  };
}

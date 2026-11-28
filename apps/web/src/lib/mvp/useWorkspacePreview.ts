'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { downloadV2Streamed } from '@/lib/mvp/multipart-client';
import {
  getLinkPreviewInfo,
  getPreviewKind,
  type DecryptedFeedItem,
} from '@/lib/mvp/feed-selectors';
import {
  convertHeicIfNeeded,
  fetchDecryptedPlainBlob as fetchPlainBlobWithKey,
} from '@/lib/mvp/workspace-blobs';

interface UseWorkspacePreviewArgs {
  items: DecryptedFeedItem[];
  cryptoKey: CryptoKey | null;
  hkdfKey: CryptoKey | null;
  setErrorMsg: Dispatch<SetStateAction<string | null>>;
}

export function useWorkspacePreview({
  items,
  cryptoKey,
  hkdfKey,
  setErrorMsg,
}: UseWorkspacePreviewArgs) {
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [previewItem, setPreviewItem] = useState<DecryptedFeedItem | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const previewUrlsRef = useRef<Record<string, string>>({});
  const previewInFlightRef = useRef<Map<string, Promise<string | null>>>(new Map());

  const fetchDecryptedPlainBlob = useCallback(
    async (item: DecryptedFeedItem): Promise<Blob | null> => {
      if (!cryptoKey) return null;
      if (item.meta.formatVersion === 2 && hkdfKey && item.raw.blob_key) {
        const res = await downloadV2Streamed(hkdfKey, item, { saveToDisk: false });
        return res.streamedToDisk ? null : res.blob;
      }
      return fetchPlainBlobWithKey(cryptoKey, item);
    },
    [cryptoKey, hkdfKey]
  );

  const getDecryptedBlobUrl = useCallback(
    async (item: DecryptedFeedItem): Promise<string | null> => {
      if (!cryptoKey || !item.raw.blob_key) return null;
      const existing = previewUrlsRef.current[item.raw.id];
      if (existing) return existing;

      const inflight = previewInFlightRef.current.get(item.raw.id);
      if (inflight) return inflight;

      const task = (async () => {
        try {
          const plainBlob = await fetchDecryptedPlainBlob(item);
          if (!plainBlob) return null;
          const displayBlob = await convertHeicIfNeeded(plainBlob, item);
          const objectUrl = URL.createObjectURL(displayBlob);
          previewUrlsRef.current[item.raw.id] = objectUrl;
          setPreviewUrls((curr) => ({ ...curr, [item.raw.id]: objectUrl }));
          return objectUrl;
        } catch {
          return null;
        } finally {
          previewInFlightRef.current.delete(item.raw.id);
        }
      })();

      previewInFlightRef.current.set(item.raw.id, task);
      return task;
    },
    [cryptoKey, fetchDecryptedPlainBlob]
  );

  useEffect(() => {
    if (!cryptoKey) return;
    const MAX_AUTO_THUMB_BYTES = 10 * 1024 * 1024;
    for (const item of items) {
      if (
        item.raw.blob_key &&
        getPreviewKind(item) === 'image' &&
        item.raw.size_bytes <= MAX_AUTO_THUMB_BYTES &&
        !previewUrlsRef.current[item.raw.id] &&
        !previewInFlightRef.current.has(item.raw.id)
      ) {
        void getDecryptedBlobUrl(item);
      }
    }
  }, [items, cryptoKey, getDecryptedBlobUrl]);

  useEffect(() => {
    const urlsMap = previewUrlsRef.current;
    return () => {
      for (const url of Object.values(urlsMap)) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const handlePreview = useCallback(
    async (item: DecryptedFeedItem) => {
      setPreviewItem(item);
      setPreviewText(null);
      if (item.raw.kind === 'link') {
        setPreviewLoading(false);
        return;
      }
      setPreviewLoading(true);
      try {
        const url = await getDecryptedBlobUrl(item);
        if (!url) {
          setErrorMsg('Unable to decrypt file preview.');
          return;
        }
        if (getPreviewKind(item) === 'text') {
          const txt = await (await fetch(url)).text();
          setPreviewText(txt.slice(0, 50000));
        }
      } finally {
        setPreviewLoading(false);
      }
    },
    [getDecryptedBlobUrl, setErrorMsg]
  );

  const previewableItems = useMemo(
    () =>
      items.filter((it) => {
        if (it.raw.kind === 'media' || it.raw.kind === 'file') {
          return getPreviewKind(it) !== null;
        }
        if (it.raw.kind === 'link' && it.bodyText) {
          return Boolean(getLinkPreviewInfo(it.bodyText)?.youtubeEmbedUrl);
        }
        return false;
      }),
    [items]
  );

  const previewIndex = previewItem
    ? previewableItems.findIndex((it) => it.raw.id === previewItem.raw.id)
    : -1;

  const stepPreview = useCallback(
    (delta: -1 | 1) => {
      if (previewIndex < 0 || previewableItems.length <= 1) return;
      const nextIdx = (previewIndex + delta + previewableItems.length) % previewableItems.length;
      void handlePreview(previewableItems[nextIdx]);
    },
    [handlePreview, previewIndex, previewableItems]
  );

  useEffect(() => {
    if (!previewItem) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') stepPreview(-1);
      if (e.key === 'ArrowRight') stepPreview(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewItem, stepPreview]);

  return {
    previewUrls,
    setPreviewUrls,
    previewUrlsRef,
    previewItem,
    setPreviewItem,
    previewText,
    setPreviewText,
    previewLoading,
    fetchDecryptedPlainBlob,
    getDecryptedBlobUrl,
    handlePreview,
    previewableItems,
    previewIndex,
    stepPreview,
  };
}

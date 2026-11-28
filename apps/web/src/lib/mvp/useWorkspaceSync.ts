'use client';

import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { FeedItemRecord, WorkspaceRecord } from '@/lib/mvp/constants';
import {
  decryptString,
  generateWorkspaceKey,
  importWorkspaceHkdfKey,
  importWorkspaceKey,
  type DecryptedItemMeta,
} from '@/lib/mvp/crypto';
import { getSavedDeviceName } from '@/lib/mvp/device-label';
import type { DecryptedFeedItem } from '@/lib/mvp/feed-selectors';
import { getWorkspaceKey, saveWorkspaceKey } from '@/lib/mvp/key-store';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

interface UseWorkspaceSyncArgs {
  router: AppRouterInstance;
  workspaceId: string | undefined;
  setWorkspace: Dispatch<SetStateAction<WorkspaceRecord | null>>;
  setUserEmail: Dispatch<SetStateAction<string | null>>;
  setDeviceId: Dispatch<SetStateAction<string | null>>;
  setDevices: Dispatch<SetStateAction<Array<{ id: string; label: string }>>>;
  setMyDeviceName: Dispatch<SetStateAction<string>>;
  setDeviceCount: Dispatch<SetStateAction<number>>;
  setUsedBytes: Dispatch<SetStateAction<number>>;
  setMissingKey: Dispatch<SetStateAction<boolean>>;
  setCryptoKey: Dispatch<SetStateAction<CryptoKey | null>>;
  setHkdfKey: Dispatch<SetStateAction<CryptoKey | null>>;
  setPairUrl: Dispatch<SetStateAction<string>>;
  setItems: Dispatch<SetStateAction<DecryptedFeedItem[]>>;
  setErrorMsg: Dispatch<SetStateAction<string | null>>;
  decryptedCacheRef: MutableRefObject<Map<string, DecryptedFeedItem>>;
}

export function useWorkspaceSync({
  router,
  workspaceId,
  setWorkspace,
  setUserEmail,
  setDeviceId,
  setDevices,
  setMyDeviceName,
  setDeviceCount,
  setUsedBytes,
  setMissingKey,
  setCryptoKey,
  setHkdfKey,
  setPairUrl,
  setItems,
  setErrorMsg,
  decryptedCacheRef,
}: UseWorkspaceSyncArgs) {
  const inFlightLoadRef = useRef<Promise<void> | null>(null);
  const queuedLoadRef = useRef<Promise<void> | null>(null);

  const decryptItems = useCallback(
    async (rawItems: FeedItemRecord[], key: CryptoKey): Promise<DecryptedFeedItem[]> => {
      const cache = decryptedCacheRef.current;
      return Promise.all(
        rawItems.map(async (raw) => {
          const cached = cache.get(raw.id);
          if (
            cached &&
            cached.raw.encrypted_meta === raw.encrypted_meta &&
            cached.raw.encrypted_body === raw.encrypted_body
          ) {
            return { ...cached, raw };
          }
          try {
            const [metaJson, bodyText] = await Promise.all([
              decryptString(key, raw.encrypted_meta),
              raw.encrypted_body ? decryptString(key, raw.encrypted_body) : Promise.resolve(null),
            ]);
            const meta = JSON.parse(metaJson) as DecryptedItemMeta;
            const decrypted: DecryptedFeedItem = { raw, meta, bodyText };
            cache.set(raw.id, decrypted);
            return decrypted;
          } catch {
            return {
              raw,
              meta: { title: 'Encrypted item (key unavailable on this browser)' },
              bodyText: null,
            };
          }
        })
      );
    },
    [decryptedCacheRef]
  );

  const loadWorkspace = useCallback(async () => {
    const runSingleLoad = () => {
      const task = (async () => {
        try {
          const res = await fetch('/api/mvp/workspace', { cache: 'no-store' });

      if (!res.ok) {
        if (res.status === 401) {
          const err = (await res.json().catch(() => null)) as { code?: string } | null;
          if (err?.code === 'AUTH_REQUIRED') {
            router.replace('/login');
            return;
          }
          setWorkspace(null);
          await getSupabaseBrowser()?.auth.signOut().catch(() => undefined);
          router.replace('/login?disconnected=1');
          return;
        } else {
          setErrorMsg('Unable to load workspace.');
        }
        return;
      }
      const data = (await res.json()) as {
        workspace: WorkspaceRecord;
        devices: Array<{ id: string; label: string }>;
        items: FeedItemRecord[];
        usedBytes: number;
        userEmail?: string;
        deviceId: string;
      };

      setWorkspace(data.workspace);
      setUserEmail(data.userEmail ?? null);
      setDeviceId(data.deviceId);
      setDevices(data.devices);
      setMyDeviceName(getSavedDeviceName(data.deviceId));
      setDeviceCount(data.devices.length);
      setUsedBytes(data.usedBytes);

      let wmk = await getWorkspaceKey(data.workspace.id);
      if (!wmk) {
        if (data.items.length > 0 || data.devices.length > 1 || data.workspace.hasWrappedKey) {
          setMissingKey(true);
          setCryptoKey(null);
          setHkdfKey(null);
          setPairUrl('');
          setItems(
            data.items.map((raw) => ({
              raw,
              meta: { title: 'Encrypted item (key unavailable on this browser)' },
              bodyText: null,
            }))
          );
          return;
        }
        wmk = generateWorkspaceKey();
        await saveWorkspaceKey(data.workspace.id, wmk);
      }

      setMissingKey(false);
      const [imported, importedHkdf] = await Promise.all([
        importWorkspaceKey(wmk),
        importWorkspaceHkdfKey(wmk),
      ]);
      setCryptoKey(imported);
      setHkdfKey(importedHkdf);

      const url = `${window.location.origin}/pair?code=${encodeURIComponent(data.workspace.pair_code)}#wmk=${wmk}`;
      setPairUrl(url);

      const decrypted = await decryptItems(data.items, imported);
      setItems(decrypted);
        } catch {
          setErrorMsg('Unable to load workspace. Refresh to try again.');
        } finally {
          inFlightLoadRef.current = null;
        }
      })();
      inFlightLoadRef.current = task;
      return task;
    };

    if (inFlightLoadRef.current) {
      if (!queuedLoadRef.current) {
        queuedLoadRef.current = inFlightLoadRef.current
          .catch(() => undefined)
          .then(() => {
            queuedLoadRef.current = null;
            return runSingleLoad();
          });
      }
      return queuedLoadRef.current;
    }

    return runSingleLoad();
  }, [
    decryptItems,
    router,
    setCryptoKey,
    setDeviceCount,
    setDeviceId,
    setDevices,
    setErrorMsg,
    setHkdfKey,
    setItems,
    setMissingKey,
    setMyDeviceName,
    setPairUrl,
    setUsedBytes,
    setUserEmail,
    setWorkspace,
  ]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!workspaceId) return;
    let pollMs = 12000;
    let pollTimer: number | null = null;
    let lastRefreshAt = 0;

    const refreshIfVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastRefreshAt < 400) return;
      lastRefreshAt = now;
      void loadWorkspace();
    };

    const setPollInterval = (nextMs: number) => {
      if (pollTimer !== null && pollMs === nextMs) return;
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
      }
      pollMs = nextMs;
      pollTimer = window.setInterval(refreshIfVisible, pollMs);
    };

    // Keep a lightweight 12s poll even when SSE is open (serverless instances don't share in-memory SSE)
    setPollInterval(12000);

    const es = new EventSource('/api/mvp/events');
    es.addEventListener('ready', () => setPollInterval(12000));
    es.addEventListener('refresh', () => {
      setPollInterval(12000);
      void loadWorkspace();
    });
    es.onerror = () => {
      setPollInterval(4000);
    };

    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);
    window.addEventListener('online', refreshIfVisible);

    return () => {
      es.close();
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
      }
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
      window.removeEventListener('online', refreshIfVisible);
    };
  }, [workspaceId, loadWorkspace]);

  return { loadWorkspace };
}

'use client';

import type { Dispatch, FormEvent, MutableRefObject, SetStateAction } from 'react';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { FeedItemRecord, WorkspaceRecord } from '@/lib/mvp/constants';
import {
  classifyTextKind,
  encryptString,
  importWorkspaceKey,
  type DecryptedItemMeta,
} from '@/lib/mvp/crypto';
import { downloadV2Streamed } from '@/lib/mvp/multipart-client';
import type { DecryptedFeedItem } from '@/lib/mvp/feed-selectors';
import { deleteWorkspaceKey, saveWorkspaceKey } from '@/lib/mvp/key-store';
import { exportItemsToZip } from '@/lib/mvp/workspace-blobs';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

interface UseWorkspaceActionsArgs {
  router: AppRouterInstance;
  workspace: WorkspaceRecord | null;
  cryptoKey: CryptoKey | null;
  hkdfKey: CryptoKey | null;
  items: DecryptedFeedItem[];
  setItems: Dispatch<SetStateAction<DecryptedFeedItem[]>>;
  devices: Array<{ id: string; label: string }>;
  setDevices: Dispatch<SetStateAction<Array<{ id: string; label: string }>>>;
  deviceCount: number;
  setDeviceCount: Dispatch<SetStateAction<number>>;
  deviceFilter: string;
  setDeviceFilter: Dispatch<SetStateAction<string>>;
  setUsedBytes: Dispatch<SetStateAction<number>>;
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  setPinnedIds: Dispatch<SetStateAction<string[]>>;
  editingItem: DecryptedFeedItem | null;
  setEditingItem: Dispatch<SetStateAction<DecryptedFeedItem | null>>;
  editDraft: string;
  setEditDraft: Dispatch<SetStateAction<string>>;
  setSavingEdit: Dispatch<SetStateAction<boolean>>;
  exportingZip: boolean;
  setExportingZip: Dispatch<SetStateAction<boolean>>;
  setAccountMenuOpen: Dispatch<SetStateAction<boolean>>;
  setClearingFeed: Dispatch<SetStateAction<boolean>>;
  setClearFeedOpen: Dispatch<SetStateAction<boolean>>;
  feedbackCategory: string;
  feedbackText: string;
  setFeedbackText: Dispatch<SetStateAction<string>>;
  setFeedbackSubmitting: Dispatch<SetStateAction<boolean>>;
  setFeedbackSent: Dispatch<SetStateAction<boolean>>;
  setFeedbackOpen: Dispatch<SetStateAction<boolean>>;
  deleteConfirmText: string;
  setDeletingAccount: Dispatch<SetStateAction<boolean>>;
  setDownloadingId: Dispatch<SetStateAction<string | null>>;
  setCopiedImageId: Dispatch<SetStateAction<string | null>>;
  recoveryDraft: string;
  setRecoveryDraft: Dispatch<SetStateAction<string>>;
  setUnlockingKey: Dispatch<SetStateAction<boolean>>;
  setMissingKey: Dispatch<SetStateAction<boolean>>;
  setUndoDelete: Dispatch<SetStateAction<{ id: string; label: string } | null>>;
  setErrorMsg: Dispatch<SetStateAction<string | null>>;
  setInfoMsg: Dispatch<SetStateAction<string | null>>;
  setPreviewUrls: Dispatch<SetStateAction<Record<string, string>>>;
  previewUrlsRef: MutableRefObject<Record<string, string>>;
  decryptedCacheRef: MutableRefObject<Map<string, DecryptedFeedItem>>;
  pendingDeleteRef: MutableRefObject<{
    id: string;
    item: DecryptedFeedItem;
    timer: number;
  } | null>;
  fetchDecryptedPlainBlob: (item: DecryptedFeedItem) => Promise<Blob | null>;
  getDecryptedBlobUrl: (item: DecryptedFeedItem) => Promise<string | null>;
  loadWorkspace: () => Promise<void>;
}

export function useWorkspaceActions({
  router,
  workspace,
  cryptoKey,
  hkdfKey,
  items,
  setItems,
  devices,
  setDevices,
  deviceCount,
  setDeviceCount,
  deviceFilter,
  setDeviceFilter,
  setUsedBytes,
  selectedIds,
  setSelectedIds,
  setPinnedIds,
  editingItem,
  setEditingItem,
  editDraft,
  setEditDraft,
  setSavingEdit,
  exportingZip,
  setExportingZip,
  setAccountMenuOpen,
  setClearingFeed,
  setClearFeedOpen,
  feedbackCategory,
  feedbackText,
  setFeedbackText,
  setFeedbackSubmitting,
  setFeedbackSent,
  setFeedbackOpen,
  deleteConfirmText,
  setDeletingAccount,
  setDownloadingId,
  setCopiedImageId,
  recoveryDraft,
  setRecoveryDraft,
  setUnlockingKey,
  setMissingKey,
  setUndoDelete,
  setErrorMsg,
  setInfoMsg,
  setPreviewUrls,
  previewUrlsRef,
  decryptedCacheRef,
  pendingDeleteRef,
  fetchDecryptedPlainBlob,
  getDecryptedBlobUrl,
  loadWorkspace,
}: UseWorkspaceActionsArgs) {
  const handleStartCheckout = async (interval: 'monthly' | 'yearly' = 'yearly') => {
    setErrorMsg(null);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval }),
      });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !data?.url) {
        setErrorMsg(data?.error ?? 'Unable to start Stripe checkout.');
        return;
      }
      window.location.assign(data.url);
    } catch {
      setErrorMsg('Unable to start Stripe checkout.');
    }
  };

  const handleManageBilling = async () => {
    setErrorMsg(null);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !data?.url) {
        setErrorMsg(data?.error ?? 'Unable to open billing portal.');
        return;
      }
      window.location.assign(data.url);
    } catch {
      setErrorMsg('Unable to open billing portal.');
    }
  };

  const handleExportZip = async () => {
    if (!cryptoKey || items.length === 0 || exportingZip) return;
    setAccountMenuOpen(false);
    setExportingZip(true);
    setErrorMsg(null);
    try {
      const result = await exportItemsToZip(cryptoKey, items, hkdfKey);
      if (!result.ok) {
        setErrorMsg(result.error);
      }
    } catch {
      setErrorMsg('Failed to export workspace ZIP.');
    } finally {
      setExportingZip(false);
    }
  };

  const handleClearFeed = async () => {
    setClearingFeed(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/mvp/items?all=true', { method: 'DELETE' });
      if (!res.ok) {
        setErrorMsg('Unable to clear feed.');
        return;
      }
      for (const url of Object.values(previewUrlsRef.current)) {
        URL.revokeObjectURL(url);
      }
      previewUrlsRef.current = {};
      setPreviewUrls({});
      setItems([]);
      setUsedBytes(0);
      setSelectedIds([]);
      setPinnedIds([]);
      setClearFeedOpen(false);
    } catch {
      setErrorMsg('Unable to clear feed.');
    } finally {
      setClearingFeed(false);
    }
  };

  const handleSubmitFeedback = async () => {
    const trimmed = feedbackText.trim();
    if (!trimmed) return;
    setFeedbackSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/mvp/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: feedbackCategory, message: trimmed }),
      });
      if (!res.ok) {
        setErrorMsg('Unable to send feedback.');
        return;
      }
      setFeedbackSent(true);
      setFeedbackText('');
      window.setTimeout(() => {
        setFeedbackOpen(false);
        setFeedbackSent(false);
      }, 1100);
    } catch {
      setErrorMsg('Unable to send feedback.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') return;
    setDeletingAccount(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/mvp/workspace', { method: 'DELETE' });
      if (!res.ok) {
        setErrorMsg('Unable to delete account.');
        return;
      }
      if (workspace?.id) {
        await deleteWorkspaceKey(workspace.id);
      }
      await getSupabaseBrowser()?.auth.signOut().catch(() => undefined);
      router.replace('/login');
    } catch {
      setErrorMsg('Unable to delete account.');
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleDownload = async (item: DecryptedFeedItem) => {
    if (!cryptoKey || !item.raw.blob_key) return;
    setDownloadingId(item.raw.id);
    setErrorMsg(null);
    try {
      let plainBlob: Blob | null = null;
      if (item.meta.formatVersion === 2 && hkdfKey) {
        const streamed = await downloadV2Streamed(hkdfKey, item, { saveToDisk: true });
        if (streamed.streamedToDisk) {
          return;
        }
        plainBlob = streamed.blob;
      } else {
        plainBlob = await fetchDecryptedPlainBlob(item);
      }

      if (!plainBlob) {
        setErrorMsg('Failed to decrypt downloaded file.');
        return;
      }
      const objectUrl = URL.createObjectURL(plainBlob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = item.meta.fileName || 'lyga-download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setErrorMsg('Failed to decrypt downloaded file.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCopyImage = async (item: DecryptedFeedItem) => {
    const url = await getDecryptedBlobUrl(item);
    if (!url) {
      setErrorMsg('Unable to copy image.');
      return;
    }
    try {
      const img = new Image();
      img.src = url;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Image load error'));
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.drawImage(img, 0, 0);
      const pngBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png')
      );
      if (!pngBlob || typeof ClipboardItem === 'undefined') {
        throw new Error('Clipboard image not supported');
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
      setCopiedImageId(item.raw.id);
      window.setTimeout(() => setCopiedImageId(null), 1400);
    } catch {
      setErrorMsg('Clipboard image copy is not supported in this browser — use Save instead.');
    }
  };

  const handleSaveEdit = async () => {
    if (!cryptoKey || !editingItem) return;
    const text = editDraft.trim();
    if (!text) return;
    setSavingEdit(true);
    setErrorMsg(null);
    try {
      const kind = classifyTextKind(text);
      const nextMeta: DecryptedItemMeta = {
        ...editingItem.meta,
        title: text.split('\n')[0].slice(0, 80),
      };
      const [encryptedMeta, encryptedBody] = await Promise.all([
        encryptString(cryptoKey, JSON.stringify(nextMeta)),
        encryptString(cryptoKey, text),
      ]);
      const res = await fetch('/api/mvp/items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingItem.raw.id,
          kind,
          encryptedMeta,
          encryptedBody,
        }),
      });
      if (!res.ok) {
        setErrorMsg('Unable to save changes.');
        return;
      }
      const payload = (await res.json()) as { item?: FeedItemRecord };
      const updatedRaw = payload.item ?? {
        ...editingItem.raw,
        kind,
        encrypted_meta: encryptedMeta,
        encrypted_body: encryptedBody,
      };
      const updatedDecrypted: DecryptedFeedItem = {
        raw: updatedRaw,
        meta: nextMeta,
        bodyText: text,
      };
      decryptedCacheRef.current.set(updatedRaw.id, updatedDecrypted);
      setItems((curr) => curr.map((it) => (it.raw.id === updatedRaw.id ? updatedDecrypted : it)));
      setEditingItem(null);
      setEditDraft('');
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((curr) => (curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]));
  };

  const performServerDelete = async (id: string, target?: DecryptedFeedItem) => {
    try {
      const res = await fetch(`/api/mvp/items?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
    } catch {
      if (target) {
        setItems((curr) =>
          curr.some((it) => it.raw.id === id)
            ? curr
            : [...curr, target].sort((a, b) => b.raw.created_at.localeCompare(a.raw.created_at))
        );
        if (target.raw.size_bytes) {
          setUsedBytes((curr) => curr + Number(target.raw.size_bytes || 0));
        }
      }
      setErrorMsg('Unable to delete item.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const targets = Array.from(new Set(selectedIds));
    setSelectedIds([]);
    const targetItems = items.filter((it) => targets.includes(it.raw.id));
    setItems((curr) => curr.filter((it) => !targets.includes(it.raw.id)));
    const removedBytes = targetItems.reduce((sum, it) => sum + Number(it.raw.size_bytes || 0), 0);
    if (removedBytes > 0) {
      setUsedBytes((curr) => Math.max(0, curr - removedBytes));
    }
    await Promise.all(targetItems.map((it) => performServerDelete(it.raw.id, it)));
  };

  const handleBulkDownload = async () => {
    const fileItems = items.filter(
      (it) => selectedIds.includes(it.raw.id) && (it.raw.kind === 'media' || it.raw.kind === 'file')
    );
    for (const it of fileItems) {
      await handleDownload(it);
    }
    setSelectedIds([]);
  };

  const handleDelete = (id: string) => {
    const target = items.find((it) => it.raw.id === id);
    if (!target) return;

    if (pendingDeleteRef.current) {
      window.clearTimeout(pendingDeleteRef.current.timer);
      const prev = pendingDeleteRef.current;
      pendingDeleteRef.current = null;
      void performServerDelete(prev.id, prev.item);
    }

    setItems((curr) => curr.filter((it) => it.raw.id !== id));
    if (target.raw.size_bytes) {
      setUsedBytes((curr) => Math.max(0, curr - Number(target.raw.size_bytes || 0)));
    }
    const cachedBlobUrl = previewUrlsRef.current[id];
    if (cachedBlobUrl) {
      URL.revokeObjectURL(cachedBlobUrl);
      delete previewUrlsRef.current[id];
      setPreviewUrls((curr) => {
        const next = { ...curr };
        delete next[id];
        return next;
      });
    }

    const label = target.meta.fileName || target.meta.title || 'Item';
    const timer = window.setTimeout(() => {
      if (pendingDeleteRef.current?.id === id) {
        pendingDeleteRef.current = null;
        setUndoDelete(null);
      }
      void performServerDelete(id, target);
    }, 5000);

    pendingDeleteRef.current = { id, item: target, timer };
    setUndoDelete({ id, label });
  };

  const handleUndoDelete = () => {
    const pending = pendingDeleteRef.current;
    if (!pending) return;
    window.clearTimeout(pending.timer);
    pendingDeleteRef.current = null;
    setUndoDelete(null);
    setItems((curr) =>
      curr.some((it) => it.raw.id === pending.id)
        ? curr
        : [...curr, pending.item].sort((a, b) => b.raw.created_at.localeCompare(a.raw.created_at))
    );
    if (pending.item.raw.size_bytes) {
      setUsedBytes((curr) => curr + Number(pending.item.raw.size_bytes || 0));
    }
  };

  const handleUnlockWithLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    const raw = recoveryDraft.trim();
    if (!raw) return;
    setUnlockingKey(true);
    setErrorMsg(null);
    try {
      let candidate = raw;
      if (raw.includes('#')) {
        const hash = raw.split('#')[1] ?? '';
        const hashParams = new URLSearchParams(hash);
        candidate = hashParams.get('wmk') ?? hashParams.get('k') ?? raw;
      }
      await importWorkspaceKey(candidate);
      await saveWorkspaceKey(workspace.id, candidate);
      setRecoveryDraft('');
      setMissingKey(false);
      setInfoMsg('Workspace unlocked.');
      await loadWorkspace();
    } catch {
      setErrorMsg(
        'Invalid recovery link or key. Copy the full backup recovery link from a paired device.'
      );
    } finally {
      setUnlockingKey(false);
    }
  };

  const handleRemoveDevice = async (targetDeviceId: string) => {
    setErrorMsg(null);
    const prevDevices = devices;
    const prevCount = deviceCount;
    const nextDevices = prevDevices.filter((d) => d.id !== targetDeviceId);

    setDevices(nextDevices);
    setDeviceCount(nextDevices.length);
    if (deviceFilter === targetDeviceId) {
      setDeviceFilter('all');
    }

    const res = await fetch(`/api/mvp/devices?id=${encodeURIComponent(targetDeviceId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      setDevices(prevDevices);
      setDeviceCount(prevCount);
      const err = (await res.json().catch(() => null)) as { error?: string } | null;
      setErrorMsg(err?.error ?? 'Unable to remove device.');
    }
  };

  return {
    handleStartCheckout,
    handleManageBilling,
    handleExportZip,
    handleClearFeed,
    handleSubmitFeedback,
    handleDeleteAccount,
    handleDownload,
    handleCopyImage,
    handleSaveEdit,
    toggleSelect,
    handleBulkDelete,
    handleBulkDownload,
    handleDelete,
    handleUndoDelete,
    handleUnlockWithLink,
    handleRemoveDevice,
  };
}

'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader } from '@mantine/core';
import { AlertCircle, ArrowDownToLine, Check, Lock, Sparkles, UploadCloud, X } from 'lucide-react';
import { getWorkspaceLimits, type WorkspaceRecord } from '@/lib/mvp/constants';
import {
  buildCategoryGroups,
  buildDeviceOptions,
  computeVaultBreakdown,
  countFeedKinds,
  formatBytes,
  type DecryptedFeedItem,
  type TabFilter,
} from '@/lib/mvp/feed-selectors';
import { useWorkspaceActions } from '@/lib/mvp/useWorkspaceActions';
import { useWorkspaceComposerActions } from '@/lib/mvp/useWorkspaceComposerActions';
import { useWorkspacePreview } from '@/lib/mvp/useWorkspacePreview';
import { useWorkspaceSync } from '@/lib/mvp/useWorkspaceSync';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { WorkspaceCategoryView } from '@/components/mvp/WorkspaceCategoryView';
import { WorkspaceComposer } from '@/components/mvp/WorkspaceComposer';
import { WorkspaceHeader } from '@/components/mvp/WorkspaceHeader';
import { WorkspaceAccountMenu, WorkspaceRailPanel } from '@/components/mvp/WorkspaceRailPanel';
import { WorkspaceStream } from '@/components/mvp/WorkspaceStream';
import {
  SyncPinModal,
  WorkspaceKeySetupAndApproveBanners,
  WorkspaceKeyUnlockBanner,
} from './WorkspaceKeyBanners';
import styles from './Workspace.module.css';

const WorkspacePreviewModal = dynamic(
  () => import('@/components/mvp/WorkspacePreviewModal').then((m) => m.WorkspacePreviewModal),
  { ssr: false }
);
const FeedbackModal = dynamic(
  () => import('@/components/mvp/WorkspaceModals').then((m) => m.FeedbackModal),
  { ssr: false }
);
const ClearFeedModal = dynamic(
  () => import('@/components/mvp/WorkspaceModals').then((m) => m.ClearFeedModal),
  { ssr: false }
);
const DeleteAccountModal = dynamic(
  () => import('@/components/mvp/WorkspaceModals').then((m) => m.DeleteAccountModal),
  { ssr: false }
);
const EditItemModal = dynamic(
  () => import('@/components/mvp/WorkspaceModals').then((m) => m.EditItemModal),
  { ssr: false }
);

export default function WorkspacePage() {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<WorkspaceRecord | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [devices, setDevices] = useState<Array<{ id: string; label: string }>>([]);
  const [myDeviceName, setMyDeviceName] = useState('This device');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [deviceCount, setDeviceCount] = useState(1);
  const [usedBytes, setUsedBytes] = useState(0);
  const [items, setItems] = useState<DecryptedFeedItem[]>([]);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [hkdfKey, setHkdfKey] = useState<CryptoKey | null>(null);
  const [pairUrl, setPairUrl] = useState('');
  const [filter, setFilter] = useState<TabFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'largest'>('newest');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    fileName: string;
    sizeBytes: number;
    stage: 'Preparing' | 'Encrypting' | 'Uploading' | 'Saving';
    pct: number;
  } | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pairCopied, setPairCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!infoMsg) return;
    const timer = window.setTimeout(() => setInfoMsg(null), 4000);
    return () => window.clearTimeout(timer);
  }, [infoMsg]);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [syncPinModalOpen, setSyncPinModalOpen] = useState(false);
  const [copiedImageId, setCopiedImageId] = useState<string | null>(null);
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [mediaView, setMediaView] = useState<'grid' | 'list'>('grid');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<DecryptedFeedItem | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [selectedBubbleId, setSelectedBubbleId] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(true);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [clearFeedOpen, setClearFeedOpen] = useState(false);
  const [clearingFeed, setClearingFeed] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<'bug' | 'idea' | 'other'>('idea');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [missingKey, setMissingKey] = useState(false);
  const [recoveryDraft, setRecoveryDraft] = useState('');
  const [unlockingKey, setUnlockingKey] = useState(false);
  const [confirmDisconnectId, setConfirmDisconnectId] = useState<string | null>(null);
  const [undoDelete, setUndoDelete] = useState<{ id: string; label: string } | null>(null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<{
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docsInputRef = useRef<HTMLInputElement>(null);
  const attachMenuWrapRef = useRef<HTMLDivElement>(null);
  const accountMenuDesktopRef = useRef<HTMLDivElement>(null);
  const accountMenuMobileRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const decryptedCacheRef = useRef<Map<string, DecryptedFeedItem>>(new Map());
  const pendingDeleteRef = useRef<{
    id: string;
    item: DecryptedFeedItem;
    timer: number;
  } | null>(null);

  const workspaceId = workspace?.id;

  const { loadWorkspace } = useWorkspaceSync({
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
  });

  useEffect(() => {
    if (!workspaceId) return;
    try {
      const raw = localStorage.getItem(`lyga:pinned:${workspaceId}`);
      setPinnedIds(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setPinnedIds([]);
    }
  }, [workspaceId]);

  const togglePin = useCallback(
    (id: string) => {
      setPinnedIds((curr) => {
        const next = curr.includes(id) ? curr.filter((x) => x !== id) : [id, ...curr];
        if (workspaceId) {
          try {
            localStorage.setItem(`lyga:pinned:${workspaceId}`, JSON.stringify(next));
          } catch {
            // ignore storage errors
          }
        }
        return next;
      });
    },
    [workspaceId]
  );

  useEffect(() => {
    setSelectedIds([]);
    setAttachMenuOpen(false);
  }, [filter]);

  useEffect(() => {
    if (filter === 'all' && streamRef.current) {
      streamRef.current.scrollTo({
        top: streamRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [items.length, filter]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(140, el.scrollHeight)}px`;
  }, [draft]);

  useEffect(() => {
    const root = document.documentElement;
    const prevHtmlBg = root.style.backgroundColor;
    const prevBodyBg = document.body.style.backgroundColor;
    const prevHtmlOverflow = root.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevOverscroll = root.style.overscrollBehavior;

    const restoreRootStyles = () => {
      root.style.removeProperty('--app-height');
      root.style.removeProperty('--app-offset-top');
      delete root.dataset.kb;
      root.style.backgroundColor = prevHtmlBg;
      document.body.style.backgroundColor = prevBodyBg;
      root.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      root.style.overscrollBehavior = prevOverscroll;
    };

    root.style.backgroundColor = '#061a18';
    document.body.style.backgroundColor = '#061a18';
    root.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    root.style.overscrollBehavior = 'none';

    const vv = window.visualViewport;
    if (!vv) {
      return restoreRootStyles;
    }

    let prevHeight = vv.height;
    let baselineHeight = vv.height;
    let prevWidth = vv.width;

    const syncViewport = () => {
      if (Math.abs(vv.width - prevWidth) > 10) {
        baselineHeight = vv.height;
        prevWidth = vv.width;
      } else if (vv.height > baselineHeight) {
        baselineHeight = vv.height;
      }

      root.style.setProperty('--app-height', `${vv.height}px`);
      root.style.setProperty('--app-offset-top', `${vv.offsetTop}px`);
      root.dataset.kb = vv.height < baselineHeight - 100 ? 'open' : 'closed';

      if (vv.height < prevHeight - 80 && filterRef.current === 'all') {
        requestAnimationFrame(() => {
          if (streamRef.current) {
            streamRef.current.scrollTop = streamRef.current.scrollHeight;
          }
        });
      }
      prevHeight = vv.height;
    };

    syncViewport();
    vv.addEventListener('resize', syncViewport);
    vv.addEventListener('scroll', syncViewport);
    return () => {
      vv.removeEventListener('resize', syncViewport);
      vv.removeEventListener('scroll', syncViewport);
      restoreRootStyles();
    };
  }, []);

  useEffect(() => {
    if (!attachMenuOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (
        attachMenuWrapRef.current &&
        !attachMenuWrapRef.current.contains(e.target as Node)
      ) {
        setAttachMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAttachMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [attachMenuOpen]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      const inDesktop = accountMenuDesktopRef.current?.contains(target);
      const inMobile = accountMenuMobileRef.current?.contains(target);
      if (!inDesktop && !inMobile) {
        setAccountMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [accountMenuOpen]);

  const {
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
  } = useWorkspacePreview({ items, cryptoKey, hkdfKey, setErrorMsg });

  const {
    handlePasteFromClipboard,
    handleSendText,
    handleSendFiles,
    cancelUpload,
  } = useWorkspaceComposerActions({
    workspace,
    cryptoKey,
    hkdfKey,
    deviceId,
    myDeviceName,
    draft,
    setDraft,
    sending,
    setSending,
    setUploadStatus,
    setAttachMenuOpen,
    setErrorMsg,
    setInfoMsg,
    setItems,
    textareaRef,
    decryptedCacheRef,
    loadWorkspace,
  });

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(
        e as unknown as {
          prompt: () => Promise<void>;
          userChoice: Promise<{ outcome: string }>;
        }
      );
    };
    const onInstalled = () => setDeferredInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (!deferredInstallPrompt) return;
    setAccountMenuOpen(false);
    await deferredInstallPrompt.prompt().catch(() => undefined);
    await deferredInstallPrompt.userChoice.catch(() => undefined);
    setDeferredInstallPrompt(null);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const billing = params.get('billing');
    if (billing === 'success') {
      setInfoMsg('Welcome to Lyga Pro! 5 GB uploads and 100 GB vault are now active.');
      void loadWorkspace();
    } else if (billing === 'cancelled') {
      setInfoMsg('Checkout cancelled — no changes were made to your plan.');
    }
    if (billing) {
      params.delete('billing');
      const nextQuery = params.toString();
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
      window.history.replaceState(null, '', nextUrl);
    }
  }, [loadWorkspace]);

  const {
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
  } = useWorkspaceActions({
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
  });

  const chronologicalItems = useMemo(() => {
    const base = filter === 'all' ? items : items.filter((it) => it.raw.kind === filter);
    return [...base].reverse();
  }, [filter, items]);

  const deferredSearchQuery = useDeferredValue(searchQuery);

  const counts = useMemo(() => countFeedKinds(items), [items]);

  const peerColorMap = useMemo(() => {
    const map = new Map<string, string>();
    const peerClasses = [styles.peer0, styles.peer1, styles.peer2, styles.peer3];
    let slot = 0;

    for (const dev of devices) {
      if (dev.id !== deviceId && !map.has(dev.id)) {
        map.set(dev.id, peerClasses[slot % peerClasses.length]);
        slot += 1;
      }
    }

    for (const it of items) {
      const sid = it.meta.senderDeviceId;
      if (sid && sid !== deviceId && !map.has(sid)) {
        map.set(sid, peerClasses[slot % peerClasses.length]);
        slot += 1;
      }
    }

    return map;
  }, [devices, deviceId, items]);

  const deviceOptions = useMemo(
    () => buildDeviceOptions(devices, items, deviceId, myDeviceName),
    [devices, deviceId, items, myDeviceName]
  );

  const deviceOptionMap = useMemo(
    () => new Map(deviceOptions.map((opt) => [opt.id, opt])),
    [deviceOptions]
  );

  const categoryGroups = useMemo(
    () =>
      buildCategoryGroups({
        filter,
        items,
        searchQuery: deferredSearchQuery,
        sortBy,
        deviceFilter,
        deviceId,
        pinnedIds,
      }),
    [deferredSearchQuery, deviceFilter, deviceId, filter, items, pinnedIds, sortBy]
  );

  const vaultBreakdown = useMemo(() => computeVaultBreakdown(items), [items]);
  const pinnedItems = useMemo(
    () => items.filter((it) => pinnedIds.includes(it.raw.id)),
    [items, pinnedIds]
  );

  const commonMenuProps = {
    accountMenuOpen,
    setAccountMenuOpen,
    userEmail,
    workspacePlan: workspace?.plan,
    deferredInstallPrompt,
    onInstallPwa: () => void handleInstallPwa(),
    pairUrl,
    recoveryCopied,
    onCopyRecoveryLink: () => {
      void navigator.clipboard.writeText(pairUrl);
      setRecoveryCopied(true);
      window.setTimeout(() => setRecoveryCopied(false), 1600);
    },
    hasWrappedKey: workspace?.hasWrappedKey,
    missingKey,
    onOpenSyncPin: () => setSyncPinModalOpen(true),
    itemsCount: items.length,
    exportingZip,
    onExportZip: () => void handleExportZip(),
    onOpenFeedback: () => {
      setFeedbackSent(false);
      setFeedbackOpen(true);
    },
    onManageBilling: () => void handleManageBilling(),
    onStartCheckout: (interval: 'monthly' | 'yearly') => void handleStartCheckout(interval),
    onSignOut: () => {
      void (async () => {
        await getSupabaseBrowser()?.auth.signOut().catch(() => undefined);
        await fetch('/api/auth/session', { method: 'DELETE' });
        router.replace('/login');
      })();
    },
    onOpenClearFeed: () => setClearFeedOpen(true),
    onOpenDeleteAccount: () => {
      setDeleteConfirmText('');
      setDeleteAccountOpen(true);
    },
  };

  const workspaceLimits = getWorkspaceLimits(workspace);

  if (!workspace && !errorMsg) {
    return (
      <main className={styles.initialLoadingShell} aria-label="Loading workspace">
        <Loader color="spruce" size="md" />
      </main>
    );
  }

  return (
    <div className={styles.appShell}>
      <section
        className={styles.chatPane}
        aria-label="Personal encrypted chat"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) {
            setDragging(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleSendFiles(e.dataTransfer.files);
        }}
      >
        {dragging && (
          <div className={styles.dropOverlay}>
            <div className={styles.dropOverlayInner}>
              <UploadCloud size={34} />
              <span>Drop files to encrypt &amp; send</span>
    </div>
    </div>
        )}

        <WorkspaceHeader
          deviceCount={deviceCount}
          maxDevices={workspace?.max_devices ?? 2}
          totalItems={items.length}
          counts={counts}
          filter={filter}
          onSelectFilter={setFilter}
          onOpenDevicesModal={() => {
            setShowQr(true);
            setQrModalOpen(true);
          }}
          mobileAccountMenu={<WorkspaceAccountMenu {...commonMenuProps} menuRef={accountMenuMobileRef} />}
        />

        {(errorMsg || infoMsg || undoDelete) && (
          <div className={styles.toastAnchor}>
            <div
              className={`${styles.floatingToast} ${
                errorMsg ? styles.floatingToastError : styles.floatingToastInfo
              }`}
              role={errorMsg ? 'alert' : 'status'}
              aria-live="polite"
            >
              {errorMsg ? (
                <AlertCircle
                  size={15}
                  className={styles.floatingToastIconError}
                  aria-hidden="true"
                />
              ) : (
                <Sparkles
                  size={15}
                  className={styles.floatingToastIconInfo}
                  aria-hidden="true"
                />
              )}
              <span>
                {errorMsg ?? (undoDelete ? `Deleted "${undoDelete.label}"` : infoMsg)}
              </span>
              {!errorMsg && undoDelete && (
                <button
                  type="button"
                  className={styles.toastUndoBtn}
                  onClick={handleUndoDelete}
                >
                  Undo
                </button>
              )}
              <button
                type="button"
                className={styles.floatingToastClose}
                aria-label="Dismiss notification"
                onClick={() => {
                  setErrorMsg(null);
                  setInfoMsg(null);
                  setUndoDelete(null);
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {missingKey && workspace ? (
          <WorkspaceKeyUnlockBanner
            workspace={workspace}
            myDeviceName={myDeviceName}
            recoveryDraft={recoveryDraft}
            setRecoveryDraft={setRecoveryDraft}
            unlockingKey={unlockingKey}
            onUnlockWithLink={handleUnlockWithLink}
            onUnlocked={loadWorkspace}
            setErrorMsg={setErrorMsg}
            setInfoMsg={setInfoMsg}
          />
        ) : workspace ? (
          <WorkspaceKeySetupAndApproveBanners
            workspace={workspace}
            onWrappedSaved={loadWorkspace}
            setErrorMsg={setErrorMsg}
            setInfoMsg={setInfoMsg}
          />
        ) : null}

        <div
          ref={streamRef}
          className={styles.messageStream}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedBubbleId(null);
            }
          }}
        >
          {filter !== 'all' ? (
            <WorkspaceCategoryView
              filter={filter}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              deviceFilter={deviceFilter}
              setDeviceFilter={setDeviceFilter}
              sortBy={sortBy}
              setSortBy={setSortBy}
              mediaView={mediaView}
              setMediaView={setMediaView}
              categoryGroups={categoryGroups}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              toggleSelect={toggleSelect}
              deviceOptions={deviceOptions}
              deviceOptionMap={deviceOptionMap}
              deviceId={deviceId}
              myDeviceName={myDeviceName}
              previewUrls={previewUrls}
              pinnedIds={pinnedIds}
              togglePin={togglePin}
              downloadingId={downloadingId}
              copiedId={copiedId}
              onCopyText={(id, value) => {
                void navigator.clipboard.writeText(value);
                setCopiedId(id);
                window.setTimeout(() => setCopiedId(null), 1200);
              }}
              onPreview={(item) => void handlePreview(item)}
              onDownload={(item) => void handleDownload(item)}
              onBulkDownload={() => void handleBulkDownload()}
              onBulkDelete={() => void handleBulkDelete()}
              onEditItem={(item) => {
                setEditingItem(item);
                setEditDraft(item.bodyText ?? '');
              }}
              onDeleteItem={(id) => void handleDelete(id)}
            />
          ) : (
            <WorkspaceStream
              chronologicalItems={chronologicalItems}
              deviceId={deviceId}
              myDeviceName={myDeviceName}
              deviceOptionMap={deviceOptionMap}
              peerColorMap={peerColorMap}
              pinnedIds={pinnedIds}
              togglePin={togglePin}
              copiedId={copiedId}
              onCopyText={(id, value) => {
                void navigator.clipboard.writeText(value);
                setCopiedId(id);
                window.setTimeout(() => setCopiedId(null), 1200);
              }}
              selectedBubbleId={selectedBubbleId}
              setSelectedBubbleId={setSelectedBubbleId}
              downloadingId={downloadingId}
              workspaceLimits={workspaceLimits}
              onPreview={(item) => void handlePreview(item)}
              onDownload={(item) => void handleDownload(item)}
              onEditItem={(item) => {
                setEditingItem(item);
                setEditDraft(item.bodyText ?? '');
              }}
              onDeleteItem={(id) => void handleDelete(id)}
              bottomRef={bottomRef}
            />
          )}
    </div>

        {(filter === 'all' ||
          filter === 'text' ||
          filter === 'link' ||
          filter === 'file' ||
          filter === 'media' ||
          uploadStatus !== null) && (
          <WorkspaceComposer
            filter={filter}
            sending={sending}
            draft={draft}
            setDraft={setDraft}
            uploadStatus={uploadStatus}
            attachMenuOpen={attachMenuOpen}
            setAttachMenuOpen={setAttachMenuOpen}
            attachMenuWrapRef={attachMenuWrapRef}
            textareaRef={textareaRef}
            fileInputRef={fileInputRef}
            mediaInputRef={mediaInputRef}
            cameraInputRef={cameraInputRef}
            docsInputRef={docsInputRef}
            onSendText={() => void handleSendText()}
            onSendFiles={(files) => void handleSendFiles(files)}
            onPasteFromClipboard={() => void handlePasteFromClipboard()}
            onCancelUpload={cancelUpload}
          />
        )}
      </section>

      <WorkspaceRailPanel
        desktopMenuProps={{ ...commonMenuProps, menuRef: accountMenuDesktopRef, showLabel: true }}
        pinnedItems={pinnedItems}
        copiedId={copiedId}
        onCopyPinned={(id, value) => {
          void navigator.clipboard.writeText(value);
          setCopiedId(id);
          window.setTimeout(() => setCopiedId(null), 1200);
        }}
        onPreview={(item) => void handlePreview(item)}
        usedBytes={usedBytes}
        workspaceLimits={workspaceLimits}
        vaultBreakdown={vaultBreakdown}
        onSelectFilter={setFilter}
        devices={devices}
        deviceId={deviceId}
        deviceOptionMap={deviceOptionMap}
        myDeviceName={myDeviceName}
        setMyDeviceName={setMyDeviceName}
        setDevices={setDevices}
        editingName={editingName}
        setEditingName={setEditingName}
        nameDraft={nameDraft}
        setNameDraft={setNameDraft}
        confirmDisconnectId={confirmDisconnectId}
        setConfirmDisconnectId={setConfirmDisconnectId}
        onRemoveDevice={(id) => void handleRemoveDevice(id)}
        showQr={showQr}
        setShowQr={setShowQr}
        pairUrl={pairUrl}
        pairCopied={pairCopied}
        onCopyPairUrl={() => {
          void navigator.clipboard.writeText(pairUrl);
          setPairCopied(true);
          window.setTimeout(() => setPairCopied(false), 1800);
        }}
        qrModalOpen={qrModalOpen}
        onCloseQrModal={() => setQrModalOpen(false)}
      />

      <FeedbackModal
        opened={feedbackOpen}
        category={feedbackCategory}
        text={feedbackText}
        sent={feedbackSent}
        submitting={feedbackSubmitting}
        onClose={() => setFeedbackOpen(false)}
        onCategoryChange={setFeedbackCategory}
        onTextChange={setFeedbackText}
        onSubmit={() => void handleSubmitFeedback()}
      />

      <ClearFeedModal
        opened={clearFeedOpen}
        itemCount={items.length}
        clearing={clearingFeed}
        onClose={() => setClearFeedOpen(false)}
        onConfirm={() => void handleClearFeed()}
      />

      <DeleteAccountModal
        opened={deleteAccountOpen}
        confirmText={deleteConfirmText}
        deleting={deletingAccount}
        onClose={() => setDeleteAccountOpen(false)}
        onConfirmTextChange={setDeleteConfirmText}
        onConfirm={() => void handleDeleteAccount()}
      />

      <WorkspacePreviewModal
        previewItem={previewItem}
        previewText={previewText}
        previewLoading={previewLoading}
        previewUrls={previewUrls}
        previewableCount={previewableItems.length}
        previewIndex={previewIndex}
        copiedImageId={copiedImageId}
        downloadingId={downloadingId}
        onClose={() => {
          setPreviewItem(null);
          setPreviewText(null);
        }}
        onStep={stepPreview}
        onCopyImage={(item) => void handleCopyImage(item)}
        onDownload={(item) => void handleDownload(item)}
      />
      <EditItemModal
        opened={Boolean(editingItem)}
        draft={editDraft}
        saving={savingEdit}
        onClose={() => {
          setEditingItem(null);
          setEditDraft('');
        }}
        onDraftChange={setEditDraft}
        onSave={() => void handleSaveEdit()}
      />
      <SyncPinModal
        opened={syncPinModalOpen}
        workspace={workspace}
        onClose={() => setSyncPinModalOpen(false)}
        onSaved={loadWorkspace}
        setInfoMsg={setInfoMsg}
      />
    </div>
  );
}

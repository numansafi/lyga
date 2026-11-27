'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Loader, Modal } from '@mantine/core';
import {
  AlertCircle,
  Archive,
  ArrowDownToLine,
  Camera,
  Check,
  ClipboardPaste,
  Code2,
  Copy,
  Download,
  Eraser,
  ExternalLink,
  Eye,
  FileArchive,
  FileText,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  List,
  Lock,
  LogOut,
  MessageSquare,
  Minus,
  Pencil,
  Pin,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  StickyNote,
  Trash2,
  UploadCloud,
  UserX,
  X,
} from 'lucide-react';
import {
  FREE_EXPIRY_DAYS,
  FREE_MAX_STORAGE_BYTES,
  type FeedItemKind,
  type FeedItemRecord,
  type WorkspaceRecord,
} from '@/lib/mvp/constants';
import {
  classifyFileKind,
  classifyTextKind,
  decryptString,
  encryptFileChunked,
  encryptString,
  generateWorkspaceKey,
  importWorkspaceKey,
  type DecryptedItemMeta,
} from '@/lib/mvp/crypto';
import { getSavedDeviceName, saveDeviceName } from '@/lib/mvp/device-label';
import {
  buildCategoryGroups,
  buildDeviceOptions,
  computeVaultBreakdown,
  countFeedKinds,
  formatBytes,
  formatTime,
  getFileExtension,
  getLinkPreviewInfo,
  getPreviewKind,
  IMAGE_EXTS,
  isSafeHttpUrl,
  type DecryptedFeedItem,
  type PreviewKind,
  type TabFilter,
} from '@/lib/mvp/feed-selectors';
import { deleteWorkspaceKey, getWorkspaceKey, saveWorkspaceKey } from '@/lib/mvp/key-store';
import {
  convertHeicIfNeeded,
  exportItemsToZip,
  fetchDecryptedPlainBlob as fetchPlainBlobWithKey,
} from '@/lib/mvp/workspace-blobs';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import styles from './Workspace.module.css';

const LygaQrCode = dynamic(
  () => import('@/components/LygaQrCode').then((m) => m.LygaQrCode),
  { ssr: false }
);
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

const ARCHIVE_EXTS = new Set(['zip', 'rar', '7z', 'tar', 'gz']);
const PDF_EXTS = new Set(['pdf']);

function DarkFileBadge({ ext }: { ext: string }) {
  const norm = ext.toLowerCase();
  const tone = PDF_EXTS.has(norm)
    ? 'pdf'
    : ARCHIVE_EXTS.has(norm)
      ? 'zip'
      : IMAGE_EXTS.has(norm)
        ? 'media'
        : 'doc';

  const Icon = IMAGE_EXTS.has(norm)
    ? ImageIcon
    : ARCHIVE_EXTS.has(norm)
      ? FileArchive
      : FileText;

  return (
    <div className={styles.darkFileBadge} data-tone={tone}>
      <Icon size={16} strokeWidth={2} aria-hidden="true" />
      <span className={styles.darkFileExt}>{(norm || 'file').slice(0, 4)}</span>
    </div>
  );
}

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
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [previewItem, setPreviewItem] = useState<DecryptedFeedItem | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
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
  const previewUrlsRef = useRef<Record<string, string>>({});
  const previewInFlightRef = useRef<Map<string, Promise<string | null>>>(new Map());
  const loadSeqRef = useRef(0);

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
    []
  );

  const loadWorkspace = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    try {
      const res = await fetch('/api/mvp/workspace', { cache: 'no-store' });
      if (seq !== loadSeqRef.current) return;

      if (!res.ok) {
        if (res.status === 401) {
          const err = (await res.json().catch(() => null)) as { code?: string } | null;
          if (err?.code === 'AUTH_REQUIRED') {
            router.replace('/login');
            return;
          }
          setWorkspace(null);
          setErrorMsg('This device was disconnected from the workspace.');
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
      if (seq !== loadSeqRef.current) return;

      setWorkspace(data.workspace);
      setUserEmail(data.userEmail ?? null);
      setDeviceId(data.deviceId);
      setDevices(data.devices);
      setMyDeviceName(getSavedDeviceName(data.deviceId));
      setDeviceCount(data.devices.length);
      setUsedBytes(data.usedBytes);

      let wmk = await getWorkspaceKey(data.workspace.id);
      if (!wmk) {
        wmk = generateWorkspaceKey();
        await saveWorkspaceKey(data.workspace.id, wmk);
      }

      const imported = await importWorkspaceKey(wmk);
      if (seq !== loadSeqRef.current) return;
      setCryptoKey(imported);

      const url = `${window.location.origin}/pair?code=${encodeURIComponent(data.workspace.pair_code)}#wmk=${wmk}`;
      setPairUrl(url);

      const decrypted = await decryptItems(data.items, imported);
      if (seq !== loadSeqRef.current) return;
      setItems(decrypted);
    } catch {
      if (seq !== loadSeqRef.current) return;
      setErrorMsg('Unable to load workspace. Refresh to try again.');
    }
  }, [decryptItems, router]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const workspaceId = workspace?.id;

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

  const handlePasteFromClipboard = async () => {
    setAttachMenuOpen(false);
    setErrorMsg(null);
    if (!navigator.clipboard) {
      setErrorMsg('Clipboard access is not available in this browser.');
      return;
    }

    try {
      if (typeof navigator.clipboard.read === 'function') {
        const clipItems = await navigator.clipboard.read();
        const files: File[] = [];
        for (const clipItem of clipItems) {
          const imageType = clipItem.types.find((t) => t.startsWith('image/'));
          if (imageType) {
            const blob = await clipItem.getType(imageType);
            const ext = imageType.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'png';
            files.push(new File([blob], `pasted-image.${ext}`, { type: imageType }));
          }
        }
        if (files.length > 0) {
          const dt = new DataTransfer();
          files.forEach((f) => dt.items.add(f));
          void handleSendFiles(dt.files);
          return;
        }
      }

      const text = await navigator.clipboard.readText();
      if (text) {
        setDraft((prev) => (prev ? `${prev}${prev.endsWith('\n') ? '' : '\n'}${text}` : text));
        textareaRef.current?.focus();
        return;
      }

      setInfoMsg('Nothing in clipboard to paste.');
    } catch {
      setErrorMsg('Clipboard permission denied. Tap the text box and paste directly.');
    }
  };

  const handleSendText = async () => {
    if (!cryptoKey || !draft.trim()) return;
    setErrorMsg(null);
    const text = draft.trim();
    setDraft('');
    setSending(true);
    try {
      const kind = classifyTextKind(text);
      const meta: DecryptedItemMeta = {
        title: text.split('\n')[0].slice(0, 80),
        senderDeviceId: deviceId ?? undefined,
        senderLabel: myDeviceName,
      };
      const [encryptedMeta, encryptedBody] = await Promise.all([
        encryptString(cryptoKey, JSON.stringify(meta)),
        encryptString(cryptoKey, text),
      ]);

      const res = await fetch('/api/mvp/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          encryptedMeta,
          encryptedBody,
          sizeBytes: 0,
          chunkCount: 0,
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        setDraft(text);
        setErrorMsg(err?.error ?? 'Unable to send message.');
        return;
      }

      const payload = (await res.json()) as { item?: FeedItemRecord };
      if (payload.item) {
        const decrypted: DecryptedFeedItem = { raw: payload.item, meta, bodyText: text };
        decryptedCacheRef.current.set(payload.item.id, decrypted);
        setItems((curr) =>
          curr.some((it) => it.raw.id === decrypted.raw.id) ? curr : [decrypted, ...curr]
        );
      } else {
        await loadWorkspace();
      }
    } finally {
      setSending(false);
    }
  };

  const handleSendFiles = async (fileList: FileList | null) => {
    if (!cryptoKey || !fileList || fileList.length === 0 || sending) return;
    setErrorMsg(null);

    let uploadedAny = false;
    setSending(true);
    try {
      for (const file of Array.from(fileList)) {
        setUploadStatus({
          fileName: file.name,
          sizeBytes: file.size,
          stage: 'Preparing',
          pct: 5,
        });

        const kind = classifyFileKind(file.type, file.name);
        const meta: DecryptedItemMeta = {
          title: file.name,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          senderDeviceId: deviceId ?? undefined,
          senderLabel: myDeviceName,
        };

        const [prepRes, encryptedMeta] = await Promise.all([
          fetch('/api/mvp/upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sizeBytes: file.size }),
          }),
          encryptString(cryptoKey, JSON.stringify(meta)),
        ]);

        if (!prepRes.ok) {
          const err = (await prepRes.json().catch(() => null)) as {
            error?: string;
            code?: string;
          } | null;
          setErrorMsg(err?.error ?? 'Upload limit reached.');
          if (err?.code === 'FILE_TOO_LARGE' || err?.code === 'STORAGE_FULL') {
            setErrorMsg(`${err?.error ?? 'Free limit reached.'} Pro (£5/mo — 100 GB) is coming soon.`);
          }
          break;
        }

        const { blobKey, uploadUrl } = (await prepRes.json()) as {
          blobKey: string;
          uploadUrl: string;
        };

        const { blob, chunkCount } = await encryptFileChunked(cryptoKey, file, (pct) => {
          setUploadStatus({
            fileName: file.name,
            sizeBytes: file.size,
            stage: 'Encrypting',
            pct: Math.max(5, Math.round(pct * 0.5)),
          });
        });

        setUploadStatus({
          fileName: file.name,
          sizeBytes: file.size,
          stage: 'Uploading',
          pct: 50,
        });

        const putOk = await new Promise<boolean>((resolve) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', uploadUrl);
          xhr.setRequestHeader('Content-Type', 'application/octet-stream');
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable && ev.total > 0) {
              const frac = ev.loaded / ev.total;
              setUploadStatus({
                fileName: file.name,
                sizeBytes: file.size,
                stage: 'Uploading',
                pct: Math.min(90, 50 + Math.round(frac * 40)),
              });
            }
          };
          xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
          xhr.onerror = () => resolve(false);
          xhr.send(blob);
        });

        if (!putOk) {
          setErrorMsg('Failed to upload encrypted file.');
          break;
        }
        setUploadStatus({
          fileName: file.name,
          sizeBytes: file.size,
          stage: 'Saving',
          pct: 92,
        });

        const saveRes = await fetch('/api/mvp/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind,
            encryptedMeta,
            encryptedBody: null,
            blobKey,
            sizeBytes: file.size,
            chunkCount,
          }),
        });

        if (!saveRes.ok) {
          const err = (await saveRes.json().catch(() => null)) as { error?: string } | null;
          setErrorMsg(err?.error ?? 'Unable to save file.');
          break;
        }

        uploadedAny = true;
        setUploadStatus({
          fileName: file.name,
          sizeBytes: file.size,
          stage: 'Saving',
          pct: 100,
        });
      }

      if (uploadedAny) {
        await loadWorkspace();
      }
    } finally {
      setSending(false);
      setUploadStatus(null);
    }
  };

  const fetchDecryptedPlainBlob = useCallback(
    async (item: DecryptedFeedItem): Promise<Blob | null> => {
      if (!cryptoKey) return null;
      return fetchPlainBlobWithKey(cryptoKey, item);
    },
    [cryptoKey]
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
    [getDecryptedBlobUrl]
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

  const handleExportZip = async () => {
    if (!cryptoKey || items.length === 0 || exportingZip) return;
    setAccountMenuOpen(false);
    setExportingZip(true);
    setErrorMsg(null);
    try {
      const result = await exportItemsToZip(cryptoKey, items);
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
      const plainBlob = await fetchDecryptedPlainBlob(item);
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
    } catch {
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

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const targets = Array.from(new Set(selectedIds));
    setSelectedIds([]);
    await Promise.all(targets.map((id) => handleDelete(id)));
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

  const handleDelete = async (id: string) => {
    const target = items.find((it) => it.raw.id === id);

    setItems((curr) => curr.filter((it) => it.raw.id !== id));
    if (target?.raw.size_bytes) {
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

  const renderQrCard = () => (
    <div className={styles.qrCard}>
      <div className={styles.qrHero}>
        <div className={styles.qrStage}>
          <span className={`${styles.cornerBracket} ${styles.cornerTL}`} aria-hidden="true" />
          <span className={`${styles.cornerBracket} ${styles.cornerTR}`} aria-hidden="true" />
          <span className={`${styles.cornerBracket} ${styles.cornerBL}`} aria-hidden="true" />
          <span className={`${styles.cornerBracket} ${styles.cornerBR}`} aria-hidden="true" />

          <div className={styles.qrBox}>
            <LygaQrCode value={pairUrl} size={124} />
    </div>
    </div>
    </div>

      <div className={styles.qrBody}>
        <div className={styles.qrTitle}>Scan to connect phone</div>
        <p className={styles.qrDesc}>
          Scan with your phone camera to sync.
        </p>
        <button
          type="button"
          className={styles.qrCopyLinkBtn}
          aria-label={pairCopied ? 'Pair link copied' : 'Copy pair link'}
          disabled={!pairUrl}
          onClick={() => {
            void navigator.clipboard.writeText(pairUrl);
            setPairCopied(true);
            window.setTimeout(() => setPairCopied(false), 1400);
          }}
        >
          {pairCopied ? <Check size={11} /> : <Copy size={11} />}
          <span>{pairCopied ? 'Copied' : 'Copy pair link'}</span>
        </button>
    </div>
    </div>
  );

  const pinnedItems = useMemo(
    () => items.filter((item) => pinnedIds.includes(item.raw.id)),
    [items, pinnedIds]
  );

  const accountInitial = (userEmail?.trim()?.[0] || 'L').toUpperCase();

  const renderAccountMenu = (
    menuRef: React.RefObject<HTMLDivElement | null>,
    showLabel = false
  ) => (
    <div className={styles.accountMenuWrap} ref={menuRef}>
      <button
        type="button"
        className={showLabel ? styles.accountTriggerBtn : styles.avatarSquircle}
        aria-label="Account menu"
        aria-expanded={accountMenuOpen}
        aria-haspopup="menu"
        onClick={() => setAccountMenuOpen((prev) => !prev)}
      >
        <span className={showLabel ? styles.avatarSquircleInner : undefined}>{accountInitial}</span>
        {showLabel && (
          <span className={styles.accountTriggerMeta}>
            <span className={styles.accountTriggerName}>{userEmail ?? 'Account'}</span>
            <span className={styles.accountTriggerPlan}>Free plan</span>
          </span>
        )}
      </button>

      {accountMenuOpen && (
        <div
          className={`${styles.accountPopover} ${showLabel ? styles.accountPopoverLeft : ''}`}
          role="menu"
          aria-label="Account"
        >
          {!showLabel && (
            <>
              <div className={styles.accountPopHeader}>
                <span className={styles.accountPopEmail}>
                  {userEmail ?? 'Signed in'}
                </span>
                <span className={styles.accountPlanPill}>Free plan</span>
              </div>
              <div className={styles.railHairline} />
            </>
          )}
          {deferredInstallPrompt && (
            <button
              type="button"
              role="menuitem"
              className={styles.accountPopBtn}
              onClick={() => void handleInstallPwa()}
            >
              <Download size={13} aria-hidden="true" />
              <span>Install Lyga app</span>
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className={styles.accountPopBtn}
            disabled={!pairUrl}
            onClick={() => {
              void navigator.clipboard.writeText(pairUrl);
              setRecoveryCopied(true);
              window.setTimeout(() => setRecoveryCopied(false), 1600);
            }}
          >
            {recoveryCopied ? <Check size={13} /> : <ShieldCheck size={13} />}
            <span>{recoveryCopied ? 'Recovery link copied' : 'Copy backup recovery link'}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.accountPopBtn}
            disabled={items.length === 0 || exportingZip}
            onClick={() => void handleExportZip()}
          >
            <Archive size={13} aria-hidden="true" />
            <span>{exportingZip ? 'Exporting ZIP…' : 'Export all (.zip)'}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.accountPopBtn}
            onClick={() => {
              setAccountMenuOpen(false);
              setFeedbackSent(false);
              setFeedbackOpen(true);
            }}
          >
            <MessageSquare size={13} aria-hidden="true" />
            <span>Send feedback</span>
          </button>
          <div className={styles.railHairline} />
          <button
            type="button"
            role="menuitem"
            className={styles.accountPopBtn}
            onClick={() => {
              setAccountMenuOpen(false);
              setInfoMsg('Pro (£5/mo — 100 GB & 5 GB files) is coming soon.');
            }}
          >
            <Sparkles size={13} aria-hidden="true" style={{ color: '#5eead4' }} />
            <span style={{ color: '#5eead4' }}>Upgrade to Pro · £5/mo →</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.accountPopBtn}
            onClick={() => {
              setAccountMenuOpen(false);
              void (async () => {
                await getSupabaseBrowser()?.auth.signOut().catch(() => undefined);
                await fetch('/api/auth/session', { method: 'DELETE' });
                router.replace('/login');
              })();
            }}
          >
            <LogOut size={13} aria-hidden="true" />
            <span>Sign out</span>
          </button>
          <div className={styles.railHairline} />
          <div className={styles.accountDangerLabel}>Danger zone</div>
          <button
            type="button"
            role="menuitem"
            className={styles.accountPopBtn}
            disabled={items.length === 0}
            onClick={() => {
              setAccountMenuOpen(false);
              setClearFeedOpen(true);
            }}
          >
            <Eraser size={13} aria-hidden="true" />
            <span>Clear all storage</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={`${styles.accountPopBtn} ${styles.accountPopDanger}`}
            onClick={() => {
              setAccountMenuOpen(false);
              setDeleteConfirmText('');
              setDeleteAccountOpen(true);
            }}
          >
            <UserX size={13} aria-hidden="true" />
            <span>Delete account</span>
          </button>
        </div>
      )}
    </div>
  );

  const renderPinnedSection = (showTitle = true) => (
    <div
      className={`${styles.railSection} ${styles.pinnedSection}`}
      style={showTitle ? undefined : { paddingTop: 2 }}
    >
      <div className={styles.sectionHeaderRow}>
        {showTitle && <span className={styles.sectionTitle}>Pinned</span>}
        <span className={styles.sectionMuted}>
          {pinnedItems.length} {pinnedItems.length === 1 ? 'item' : 'items'}
        </span>
      </div>
      {pinnedItems.length === 0 ? (
        <p className={styles.pinnedEmpty}>
          Pin any message, link, or file to keep it here.
        </p>
      ) : (
        <div className={styles.pinnedList}>
          {pinnedItems.map((item) => {
            const label =
              item.meta.fileName ||
              item.meta.title ||
              item.bodyText?.slice(0, 48) ||
              'Encrypted item';
            const actionLabel =
              item.raw.kind === 'link'
                ? 'Open'
                : item.raw.kind === 'file' || item.raw.kind === 'media'
                  ? 'View'
                  : 'Copy';
            return (
              <button
                key={item.raw.id}
                type="button"
                className={styles.pinnedRow}
                onClick={() => {
                  if (item.raw.kind === 'link') {
                    const href = item.bodyText ? getLinkPreviewInfo(item.bodyText)?.safeHref : null;
                    if (href) {
                      window.open(href, '_blank', 'noopener,noreferrer');
                    } else {
                      void handlePreview(item);
                    }
                  } else if (item.raw.kind === 'file' || item.raw.kind === 'media') {
                    void handlePreview(item);
                  } else if (item.bodyText) {
                    void navigator.clipboard.writeText(item.bodyText);
                    setCopiedId(item.raw.id);
                    window.setTimeout(() => setCopiedId(null), 1400);
                  }
                }}
              >
                <span className={styles.pinnedRowLabel}>{label}</span>
                <span className={styles.pinnedRowAction}>
                  {copiedId === item.raw.id ? 'Copied' : actionLabel}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderDeviceCard = () => (
    <div className={styles.railSection}>
      <div className={styles.deviceRow}>
        <button
          type="button"
          className={`${styles.syncStatusPill} ${devices.length < 2 ? styles.syncStatusSingle : ''}`}
          onClick={() => {
            if (devices.length < 2) setShowQr((prev) => !prev);
          }}
          title={devices.length >= 2 ? 'End-to-end encrypted sync active' : 'Click to show QR code'}
        >
          <span className={styles.syncStatusDot} aria-hidden="true" />
          <span>
            {devices.length >= 2 ? `${devices.length} devices connected` : '1 device · Pair another'}
          </span>
        </button>
        <div className={styles.deviceActions}>
          <button
            type="button"
            className={styles.qrToggleBtn}
            onClick={() => setShowQr((prev) => !prev)}
          >
            {showQr ? 'Hide QR' : 'Show QR'}
          </button>
        </div>
    </div>
      {showQr && renderQrCard()}
      {editingName && deviceId && (
        <form
          className={styles.deviceEditRow}
          onSubmit={(e) => {
            e.preventDefault();
            const saved = saveDeviceName(deviceId, nameDraft);
            setMyDeviceName(saved);
            setDevices((prev) =>
              prev.map((d) => (d.id === deviceId ? { ...d, label: saved } : d))
            );
            setEditingName(false);
            void fetch('/api/mvp/devices', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: deviceId, label: saved }),
            }).catch(() => undefined);
          }}
        >
          <input
            type="text"
            className={styles.deviceInput}
            aria-label="Device name"
            value={nameDraft}
            maxLength={32}
            autoFocus
            onChange={(e) => setNameDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setEditingName(false);
              }
            }}
          />
          <button type="submit" className={styles.deviceIconBtn} aria-label="Save device name">
            <Check size={14} />
          </button>
        </form>
      )}

      {devices.length > 0 && (
        <div className={styles.devicesList}>
          {devices.map((dev) => {
            const isCurrent = dev.id === deviceId;
            const opt = deviceOptionMap.get(dev.id);
            const dotColor = opt?.dotColor ?? (isCurrent ? '#2dd4bf' : '#7dd3fc');
            const label = isCurrent ? myDeviceName : dev.label;

            return (
              <div key={dev.id} className={styles.connectedDevRow}>
                <div className={styles.connectedDevInfo}>
                  <span
                    className={styles.deviceDot}
                    style={{ backgroundColor: dotColor }}
                    aria-hidden="true"
                  />
                  <span className={styles.connectedDevName}>{label}</span>
                  {isCurrent && <span className={styles.connectedDevTag}>you</span>}
    </div>
                {isCurrent ? (
                  !editingName && (
                    <button
                      type="button"
                      className={styles.deviceIconBtn}
                      aria-label={`Rename ${label}`}
                      onClick={() => {
                        setNameDraft(myDeviceName);
                        setEditingName(true);
                      }}
                    >
                      <Pencil size={12} />
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className={styles.removeDevBtn}
                    aria-label={`Disconnect ${label}`}
                    onClick={() => void handleRemoveDevice(dev.id)}
                  >
                    Disconnect
                  </button>
                )}
    </div>
            );
          })}
    </div>
      )}
    </div>
  );

  const renderStorageCard = () => (
    <div className={styles.railSection}>
      <div className={styles.storageRow}>
        <span>Storage</span>
        <span>{formatBytes(usedBytes)} / {formatBytes(FREE_MAX_STORAGE_BYTES)}</span>
      </div>
      <div className={styles.vaultBarTrack} aria-hidden="true">
        {vaultBreakdown.mediaPct > 0 && (
          <div
            className={styles.vaultSeg}
            style={{ width: `${vaultBreakdown.mediaPct}%`, backgroundColor: '#2dd4bf' }}
          />
        )}
        {vaultBreakdown.filePct > 0 && (
          <div
            className={styles.vaultSeg}
            style={{ width: `${vaultBreakdown.filePct}%`, backgroundColor: '#60a5fa' }}
          />
        )}
        {vaultBreakdown.notePct > 0 && (
          <div
            className={styles.vaultSeg}
            style={{ width: `${vaultBreakdown.notePct}%`, backgroundColor: '#a78bfa' }}
          />
        )}
      </div>
      <div className={styles.vaultList}>
        <button
          type="button"
          className={styles.vaultItemBtn}
          onClick={() => setFilter('media')}
        >
          <span className={styles.vaultItemLeft}>
            <span className={styles.vaultSwatch} style={{ backgroundColor: '#2dd4bf' }} />
            <span>Photos &amp; Videos</span>
          </span>
          <span className={styles.vaultItemValue}>
            {formatBytes(vaultBreakdown.mediaBytes)} ({vaultBreakdown.mediaCount})
          </span>
        </button>
        <button
          type="button"
          className={styles.vaultItemBtn}
          onClick={() => setFilter('file')}
        >
          <span className={styles.vaultItemLeft}>
            <span className={styles.vaultSwatch} style={{ backgroundColor: '#60a5fa' }} />
            <span>Files &amp; PDFs</span>
          </span>
          <span className={styles.vaultItemValue}>
            {formatBytes(vaultBreakdown.fileBytes)} ({vaultBreakdown.fileCount})
          </span>
        </button>
        <button
          type="button"
          className={styles.vaultItemBtn}
          onClick={() => setFilter('text')}
        >
          <span className={styles.vaultItemLeft}>
            <span className={styles.vaultSwatch} style={{ backgroundColor: '#a78bfa' }} />
            <span>Notes &amp; Links</span>
          </span>
          <span className={styles.vaultItemValue}>
            {formatBytes(vaultBreakdown.noteBytes)} ({vaultBreakdown.noteCount})
          </span>
        </button>
      </div>
      <div className={styles.vaultDivider} />
      <div className={styles.vaultMetaRow}>
        <span>Auto-delete: After {FREE_EXPIRY_DAYS} days</span>
        <span>Max 500 MB / file</span>
      </div>
    </div>
  );

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

        <header className={styles.chatHeader}>
          <div className={styles.chatIdentity}>
            <div className={styles.chatAvatar} aria-hidden="true">
              <svg width="20" height="20" viewBox="48 48 160 178" fill="none">
                <path
                  stroke="#FFFFFF"
                  strokeWidth="28"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M64 94L92 66v116h100l-28 28"
                />
              </svg>
    </div>
            <div className={styles.chatIdentityText}>
              <h1 className={styles.chatTitle} style={{ margin: 0 }}>My Lyga</h1>
              <div className={styles.chatSub}>
                <span className={styles.chatSubEncrypted}>
                  <Lock size={11} aria-hidden="true" />
                  <span>
                    <span className={styles.hideMobile}>End-to-end </span>
                    <span className={styles.chatSubEncryptedWord}>encrypted</span>
                  </span>
                </span>
                <span className={styles.hideMobile}>·</span>
                <span className={styles.hideMobile}>
                  {deviceCount} of {workspace?.max_devices ?? 2} devices
                </span>
              </div>
            </div>
    </div>

          <div className={styles.headerRight}>
            <div className={styles.filterStrip} role="tablist" aria-label="Filter messages">
              {(
                [
                  ['all', 'All', items.length],
                  ['text', 'Notes', counts.text],
                  ['media', 'Media', counts.media],
                  ['link', 'Links', counts.link],
                  ['file', 'Files', counts.file],
                ] as const
              ).map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={filter === key}
                  className={`${styles.filterBtn} ${filter === key ? styles.filterBtnActive : ''}`}
                  onClick={() => setFilter(key)}
                >
                  <span>{label}</span>
                  {key !== 'all' && count > 0 && (
                    <span className={styles.filterCount}>{count}</span>
                  )}
                </button>
              ))}
    </div>

            <div className={styles.headerActions}>
              <Button
                size="xs"
                variant="light"
                className={styles.mobilePairBtn}
                leftSection={<Smartphone size={14} />}
                onClick={() => {
                  setShowQr(true);
                  setQrModalOpen(true);
                }}
              >
                Devices
              </Button>
              <div className={styles.mobileAccountWrap}>
                {renderAccountMenu(accountMenuMobileRef)}
              </div>
            </div>
    </div>
        </header>

        {(errorMsg || infoMsg) && (
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
              <span>{errorMsg ?? infoMsg}</span>
              <button
                type="button"
                className={styles.floatingToastClose}
                aria-label="Dismiss notification"
                onClick={() => {
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

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
            <div className={styles.categoryView}>
              <div className={styles.categoryToolbar}>
                <div className={styles.searchBox}>
                  <Search size={14} aria-hidden="true" />
                  <input
                    type="search"
                    aria-label="Search workspace items"
                    className={styles.searchInput}
                    placeholder={`Search ${
                      filter === 'text'
                        ? 'notes'
                        : filter === 'media'
                          ? 'media'
                          : filter === 'link'
                            ? 'links'
                            : filter === 'code'
                              ? 'code'
                              : 'files'
                    }…`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.currentTarget.value)}
                  />
    </div>

                <div className={styles.toolbarFilters}>
                  <div className={styles.deviceFilterRow} role="group" aria-label="Filter by device">
                    {(() => {
                      const visibleIds = Array.from(
                        new Set(categoryGroups.flatMap((g) => g.items.map((it) => it.raw.id)))
                      );
                      const allSelected =
                        visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
                      const someSelected =
                        !allSelected && visibleIds.some((id) => selectedIds.includes(id));
                      return (
                        <button
                          type="button"
                          className={`${styles.masterCheckPill} ${
                            allSelected || someSelected ? styles.masterCheckPillActive : ''
                          }`}
                          aria-label={allSelected ? 'Deselect all items' : 'Select all items'}
                          aria-pressed={allSelected}
                          disabled={visibleIds.length === 0}
                          onClick={() => {
                            if (allSelected) {
                              setSelectedIds([]);
                            } else {
                              setSelectedIds(visibleIds);
                            }
                          }}
                        >
                          <span
                            className={`${styles.itemCheckbox} ${
                              allSelected ? styles.itemCheckboxChecked : ''
                            } ${someSelected ? styles.itemCheckboxIndeterminate : ''}`}
                            aria-hidden="true"
                          >
                            {allSelected ? (
                              <Check size={11} strokeWidth={3} />
                            ) : someSelected ? (
                              <Minus size={11} strokeWidth={3} />
                            ) : null}
                          </span>
                          <span>{someSelected ? `${selectedIds.length}` : 'All'}</span>
                        </button>
                      );
                    })()}
                    <button
                      type="button"
                      className={`${styles.devicePill} ${
                        deviceFilter === 'all' ? styles.devicePillActive : ''
                      }`}
                      onClick={() => setDeviceFilter('all')}
                    >
                      All devices
                    </button>
                    {deviceOptions.map((dev) => (
                      <button
                        key={dev.id}
                        type="button"
                        className={`${styles.devicePill} ${
                          deviceFilter === dev.id ? styles.devicePillActive : ''
                        }`}
                        onClick={() => setDeviceFilter(dev.id)}
                      >
                        <span
                          className={styles.deviceDot}
                          style={{ backgroundColor: dev.dotColor }}
                          aria-hidden="true"
                        />
                        <span>{dev.label}</span>
                      </button>
                    ))}
    </div>

                  <div className={styles.sortRow} role="group" aria-label="Sort items">
                    {(
                      [
                        ['newest', 'Newest'],
                        ['oldest', 'Oldest'],
                        ...(filter === 'file' || filter === 'media'
                          ? ([['largest', 'Largest']] as const)
                          : []),
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className={`${styles.sortBtn} ${sortBy === key ? styles.sortBtnActive : ''}`}
                        onClick={() => setSortBy(key)}
                      >
                        {label}
                      </button>
                    ))}
                    {filter === 'media' && (
                      <div className={styles.viewSwitchGroup} role="group" aria-label="Media layout">
                        <button
                          type="button"
                          className={`${styles.viewSwitchBtn} ${mediaView === 'grid' ? styles.viewSwitchBtnActive : ''}`}
                          aria-label="Grid view"
                          aria-pressed={mediaView === 'grid'}
                          title="Grid view"
                          onClick={() => setMediaView('grid')}
                        >
                          <LayoutGrid size={13} />
                        </button>
                        <button
                          type="button"
                          className={`${styles.viewSwitchBtn} ${mediaView === 'list' ? styles.viewSwitchBtnActive : ''}`}
                          aria-label="List view"
                          aria-pressed={mediaView === 'list'}
                          title="List view"
                          onClick={() => setMediaView('list')}
                        >
                          <List size={13} />
                        </button>
                      </div>
                    )}
    </div>
    </div>

                {selectedIds.length > 0 && (
                  <div className={styles.bulkBar}>
                    <span className={styles.bulkCount}>{selectedIds.length} selected</span>
                    <div className={styles.bulkActions}>
                      {(filter === 'file' || filter === 'media') && (
                        <button
                          type="button"
                          className={styles.previewBtn}
                          onClick={() => void handleBulkDownload()}
                        >
                          <ArrowDownToLine size={13} />
                          <span>Save</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.bulkDeleteBtn}
                        onClick={() => void handleBulkDelete()}
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                      <button
                        type="button"
                        className={styles.actionIconBtn}
                        aria-label="Clear selection"
                        title="Clear selection"
                        onClick={() => setSelectedIds([])}
                      >
                        <X size={13} />
                      </button>
    </div>
    </div>
                )}
    </div>

              {categoryGroups.length === 0 ? (
                <div className={styles.emptyThread}>
                  <div>No matching items in this category.</div>
                  {(searchQuery || deviceFilter !== 'all') && (
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => {
                        setSearchQuery('');
                        setDeviceFilter('all');
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
    </div>
              ) : (
                categoryGroups.map((group) => (
                  <div key={group.label} className={styles.dateGroup}>
                    <div className={styles.dateGroupLabel}>{group.label}</div>
                    {filter === 'media' && mediaView === 'grid' ? (
                      <div className={styles.mediaGrid}>
                        {group.items.map((item) => {
                          const thumbUrl = previewUrls[item.raw.id];
                          const ext = getFileExtension(item.meta.fileName || item.meta.title);
                          const isSelected = selectedIds.includes(item.raw.id);
                          const isPinned = pinnedIds.includes(item.raw.id);
                          return (
                            <div
                              key={item.raw.id}
                              className={`${styles.mediaTile} ${isSelected ? styles.mediaTileSelected : ''}`}
                            >
                              <button
                                type="button"
                                className={`${styles.tileCheckBtn} ${isSelected ? styles.tileCheckBtnSelected : ''}`}
                                aria-label={isSelected ? `Deselect ${item.meta.fileName || item.meta.title}` : `Select ${item.meta.fileName || item.meta.title}`}
                                aria-pressed={isSelected}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSelect(item.raw.id);
                                }}
                              >
                                <span
                                  className={`${styles.itemCheckbox} ${styles.itemCheckboxRound} ${
                                    isSelected ? styles.itemCheckboxChecked : ''
                                  }`}
                                  aria-hidden="true"
                                >
                                  {isSelected ? <Check size={11} strokeWidth={3} /> : null}
                                </span>
                              </button>
                              <button
                                type="button"
                                className={styles.mediaTilePreview}
                                onClick={() => void handlePreview(item)}
                              >
                                {thumbUrl ? (
                                  <img
                                    src={thumbUrl}
                                    alt={item.meta.fileName || item.meta.title}
                                    className={styles.mediaTileImg}
                                  />
                                ) : (
                                  <div className={styles.mediaTileFallback}>
                                    <DarkFileBadge ext={ext} />
    </div>
                                )}
                              </button>
                              <div className={styles.mediaTileBar}>
                                <span className={styles.mediaTileName}>
                                  {item.meta.fileName || item.meta.title}
                                </span>
                                <div className={styles.mediaTileBtns}>
                                  <button
                                    type="button"
                                    className={`${styles.actionIconBtn} ${isPinned ? styles.pinActiveBtn : ''}`}
                                    aria-label={isPinned ? 'Unpin' : 'Pin'}
                                    onClick={() => togglePin(item.raw.id)}
                                  >
                                    <Pin size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.actionIconBtn}
                                    aria-label="Save"
                                    onClick={() => void handleDownload(item)}
                                  >
                                    <ArrowDownToLine size={13} />
                                  </button>
    </div>
    </div>
    </div>
                          );
                        })}
    </div>
                    ) : (
                    <div className={styles.groupCard}>
                      {group.items.map((item) => {
                        const kind = item.raw.kind;
                        const isFile = kind === 'media' || kind === 'file';
                        const isSelf =
                          !item.meta.senderDeviceId || item.meta.senderDeviceId === deviceId;
                        const senderId = item.meta.senderDeviceId ?? deviceId ?? '';
                        const senderOpt = deviceOptionMap.get(senderId);
                        const senderName = isSelf
                          ? myDeviceName
                          : senderOpt?.label ||
                            item.meta.senderLabel ||
                            'Paired device';
                        const dotColor = senderOpt?.dotColor ?? '#7dd3fc';
                        const copyValue = item.bodyText ?? item.meta.title;
                        const ext = getFileExtension(item.meta.fileName || item.meta.title);
                        const isDownloading = downloadingId === item.raw.id;
                        const pKind = isFile ? getPreviewKind(item) : null;
                        const thumbUrl = isFile ? previewUrls[item.raw.id] : undefined;
                        const linkInfo =
                          kind === 'link' && item.bodyText ? getLinkPreviewInfo(item.bodyText) : null;
                        const isSelected = selectedIds.includes(item.raw.id);

                        return (
                          <div
                            key={item.raw.id}
                            className={`${styles.groupRow} ${isSelected ? styles.groupRowSelected : ''}`}
                          >
                            <div className={styles.groupRowLeft}>
                              <button
                                type="button"
                                className={styles.rowCheckBtn}
                                aria-label={isSelected ? `Deselect ${item.meta.title || 'item'}` : `Select ${item.meta.title || 'item'}`}
                                aria-pressed={isSelected}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSelect(item.raw.id);
                                }}
                              >
                                <span
                                  className={`${styles.itemCheckbox} ${
                                    isSelected ? styles.itemCheckboxChecked : ''
                                  }`}
                                  aria-hidden="true"
                                >
                                  {isSelected ? <Check size={11} strokeWidth={3} /> : null}
                                </span>
                              </button>
                              {isFile ? (
                                thumbUrl ? (
                                  <button
                                    type="button"
                                    className={styles.thumbBtn}
                                    aria-label={`Preview ${item.meta.fileName || item.meta.title}`}
                                    onClick={() => void handlePreview(item)}
                                  >
                                    <img
                                      src={thumbUrl}
                                      alt={item.meta.fileName || item.meta.title}
                                      className={styles.thumbImg}
                                    />
                                  </button>
                                ) : (
                                  <div className={styles.fileIconWrap} aria-hidden="true">
                                    <DarkFileBadge ext={ext} />
    </div>
                                )
                              ) : linkInfo?.youtubeThumbUrl ? (
                                <a
                                  href={linkInfo.safeHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.linkThumbWrap}
                                >
                                  <img
                                    src={linkInfo.youtubeThumbUrl}
                                    alt={linkInfo.hostname}
                                    className={styles.thumbImg}
                                  />
                                </a>
                              ) : linkInfo ? (
                                <div className={styles.groupRowIcon} aria-hidden="true">
                                  <img
                                    src={linkInfo.faviconUrl}
                                    alt=""
                                    className={styles.linkFavicon}
                                  />
    </div>
                              ) : (
                                <div className={styles.groupRowIcon} aria-hidden="true">
                                  {kind === 'link' && <Link2 size={16} />}
                                  {kind === 'code' && <Code2 size={16} />}
                                  {kind === 'text' && <StickyNote size={16} />}
    </div>
                              )}

                              <div className={styles.groupRowBody}>
                                {kind === 'link' && item.bodyText ? (
                                  <>
                                    {linkInfo && (
                                      <div className={styles.linkHost}>{linkInfo.hostname}</div>
                                    )}
                                    {linkInfo ? (
                                      <a
                                        href={linkInfo.safeHref}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.groupRowLink}
                                      >
                                        {item.bodyText}
                                      </a>
                                    ) : (
                                      <span className={styles.groupRowTitle}>{item.bodyText}</span>
                                    )}
                                  </>
                                ) : (
                                  <div className={styles.groupRowTitle}>
                                    {isFile
                                      ? item.meta.fileName || item.meta.title
                                      : item.bodyText || item.meta.title}
    </div>
                                )}

                                <div className={styles.groupRowMeta}>
                                  <span className={styles.groupDeviceTag}>
                                    <span
                                      className={styles.deviceDot}
                                      style={{ backgroundColor: dotColor }}
                                      aria-hidden="true"
                                    />
                                    <span>{senderName}</span>
                                  </span>
                                  {isFile && <span>{formatBytes(item.raw.size_bytes)}</span>}
                                  <span>{formatTime(item.raw.created_at)}</span>
    </div>
    </div>
    </div>

                            <div className={styles.groupRowActions}>
                              {isFile && pKind && (
                                <button
                                  type="button"
                                  className={styles.previewBtn}
                                  aria-label={`Preview ${item.meta.fileName || item.meta.title}`}
                                  onClick={() => void handlePreview(item)}
                                >
                                  <Eye size={13} aria-hidden="true" />
                                  <span>Preview</span>
                                </button>
                              )}
                              {kind === 'link' && item.bodyText && linkInfo?.youtubeEmbedUrl && (
                                <button
                                  type="button"
                                  className={styles.previewBtn}
                                  aria-label="Watch video preview"
                                  onClick={() => void handlePreview(item)}
                                >
                                  <Eye size={13} aria-hidden="true" />
                                  <span>Preview</span>
                                </button>
                              )}
                              {kind === 'link' && linkInfo && (
                                <a
                                  href={linkInfo.safeHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.previewBtn}
                                  aria-label="Open link"
                                >
                                  <ExternalLink size={13} aria-hidden="true" />
                                  <span>Open</span>
                                </a>
                              )}
                              {isFile ? (
                                <button
                                  type="button"
                                  className={styles.saveBtnIn}
                                  disabled={isDownloading}
                                  onClick={() => void handleDownload(item)}
                                >
                                  {isDownloading ? (
                                    <Loader size={12} color="currentColor" />
                                  ) : (
                                    <ArrowDownToLine
                                      size={14}
                                      strokeWidth={2.2}
                                      aria-hidden="true"
                                    />
                                  )}
                                  <span>{isDownloading ? 'Saving…' : 'Save'}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className={styles.copyRowBtn}
                                  onClick={() => {
                                    void navigator.clipboard.writeText(copyValue);
                                    setCopiedId(item.raw.id);
                                    window.setTimeout(() => setCopiedId(null), 1200);
                                  }}
                                >
                                  {copiedId === item.raw.id ? (
                                    <Check size={13} />
                                  ) : (
                                    <Copy size={13} />
                                  )}
                                  <span>{copiedId === item.raw.id ? 'Copied' : 'Copy'}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                className={`${styles.actionIconBtn} ${
                                  pinnedIds.includes(item.raw.id) ? styles.pinActiveBtn : ''
                                }`}
                                aria-label={pinnedIds.includes(item.raw.id) ? 'Unpin item' : 'Pin item'}
                                onClick={() => togglePin(item.raw.id)}
                              >
                                <Pin size={14} />
                              </button>
                              {(kind === 'text' || kind === 'code') && item.bodyText && (
                                <button
                                  type="button"
                                  className={styles.actionIconBtn}
                                  aria-label="Edit item"
                                  onClick={() => {
                                    setEditingItem(item);
                                    setEditDraft(item.bodyText ?? '');
                                  }}
                                >
                                  <Pencil size={14} />
                                </button>
                              )}
                              <button
                                type="button"
                                className={`${styles.actionIconBtn} ${styles.actionDeleteBtn}`}
                                aria-label="Delete item"
                                onClick={() => void handleDelete(item.raw.id)}
                              >
                                <Trash2 size={14} />
                              </button>
    </div>
    </div>
                        );
                      })}
    </div>
                    )}
    </div>
                ))
              )}
    </div>
          ) : (
            <>
              <div className={styles.dayPillWrap}>
                <span className={styles.dayPill}>
                  <Lock size={11} aria-hidden="true" />
                  Only your paired devices can unlock this chat
                </span>
    </div>

              {chronologicalItems.length === 0 ? (
                <div className={styles.emptyThread}>
                  <div className={styles.emptyIcon} aria-hidden="true">
                    <Send size={18} />
    </div>
                  <div>
                    Send a note, link, code snippet, or drag a 4K video anywhere here. Everything
                    arrives encrypted at full original quality.
    </div>
    </div>
              ) : (
                chronologicalItems.map((item) => {
                  const kind = item.raw.kind;
                  const isFile = kind === 'media' || kind === 'file';
                  const copyValue = item.bodyText ?? item.meta.title;
                  const isSelf = !item.meta.senderDeviceId || item.meta.senderDeviceId === deviceId;

                  const actions = (
                    <div className={styles.bubbleActions}>
                      <button
                        type="button"
                        className={`${styles.actionIconBtn} ${
                          pinnedIds.includes(item.raw.id) ? styles.pinActiveBtn : ''
                        }`}
                        aria-label={pinnedIds.includes(item.raw.id) ? 'Unpin' : 'Pin'}
                        onClick={() => togglePin(item.raw.id)}
                      >
                        <Pin size={13} />
                      </button>
                      {(kind === 'text' || kind === 'code') && item.bodyText && (
                        <button
                          type="button"
                          className={styles.actionIconBtn}
                          aria-label="Edit message"
                          onClick={() => {
                            setEditingItem(item);
                            setEditDraft(item.bodyText ?? '');
                          }}
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                      {!isFile && (
                        <button
                          type="button"
                          className={styles.actionIconBtn}
                          aria-label={copiedId === item.raw.id ? 'Copied' : 'Copy message'}
                          onClick={() => {
                            void navigator.clipboard.writeText(copyValue);
                            setCopiedId(item.raw.id);
                            window.setTimeout(() => setCopiedId(null), 1200);
                          }}
                        >
                          {copiedId === item.raw.id ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      )}
                      <button
                        type="button"
                        className={`${styles.actionIconBtn} ${styles.actionDeleteBtn}`}
                        aria-label="Delete message"
                        onClick={() => void handleDelete(item.raw.id)}
                      >
                        <Trash2 size={14} />
                      </button>
    </div>
                  );

                  const peerClass =
                    !isSelf && item.meta.senderDeviceId
                      ? (peerColorMap.get(item.meta.senderDeviceId) ?? styles.peer0)
                      : styles.peer0;
                  const senderName =
                    (item.meta.senderDeviceId
                      ? deviceOptionMap.get(item.meta.senderDeviceId)?.label
                      : undefined) ||
                    item.meta.senderLabel ||
                    'Paired device';

                  const isSelected = selectedBubbleId === item.raw.id;

                  return (
                    <div
                      key={item.raw.id}
                      className={`${styles.msgRow} ${isSelf ? styles.msgOut : styles.msgIn} ${isSelected ? styles.msgSelected : ''}`}
                    >
                      <div className={styles.bubbleCluster}>
                        {isSelf && actions}

                        <div
                          className={isSelf ? styles.bubbleOut : `${styles.bubbleIn} ${peerClass}`}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('button, a, input, textarea')) {
                              return;
                            }
                            setSelectedBubbleId((curr) =>
                              curr === item.raw.id ? null : item.raw.id
                            );
                          }}
                        >
                        {!isSelf && <div className={styles.senderCaption}>{senderName}</div>}

                        {kind === 'link' &&
                          item.bodyText &&
                          (() => {
                            const linkInfo = getLinkPreviewInfo(item.bodyText);
                            return (
                              <div className={styles.linkPreviewCard}>
                                {linkInfo?.youtubeThumbUrl && (
                                  <button
                                    type="button"
                                    className={styles.bubbleThumbBtn}
                                    aria-label="Watch video preview"
                                    onClick={() => void handlePreview(item)}
                                  >
                                    <img
                                      src={linkInfo.youtubeThumbUrl}
                                      alt={linkInfo.hostname}
                                      className={styles.linkPreviewThumb}
                                    />
                                  </button>
                                )}
                                <div className={styles.linkPreviewMeta}>
                                  <div className={styles.linkPreviewHostRow}>
                                    {linkInfo ? (
                                      <img
                                        src={linkInfo.faviconUrl}
                                        alt=""
                                        className={styles.linkFavicon}
                                      />
                                    ) : (
                                      <Link2 size={13} aria-hidden="true" />
                                    )}
                                    <span>{linkInfo?.hostname ?? 'Link'}</span>
                                    {linkInfo?.youtubeEmbedUrl && (
                                      <button
                                        type="button"
                                        className={styles.linkInlinePreviewBtn}
                                        aria-label="Watch video preview"
                                        onClick={() => void handlePreview(item)}
                                      >
                                        <Eye size={13} aria-hidden="true" />
                                      </button>
                                    )}
    </div>
                                  {linkInfo ? (
                                    <a
                                      href={linkInfo.safeHref}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={styles.linkPreviewUrl}
                                    >
                                      {item.bodyText}
                                    </a>
                                  ) : (
                                    <span className={styles.linkPreviewUrl}>{item.bodyText}</span>
                                  )}
    </div>
    </div>
                            );
                          })()}

                        {kind === 'code' && item.bodyText && (
                          <pre className={styles.bubbleCode}>
                            <code>{item.bodyText}</code>
                          </pre>
                        )}

                        {kind === 'text' && item.bodyText && (
                          <p className={styles.bubbleText}>{item.bodyText}</p>
                        )}

                        {isFile &&
                          (() => {
                            const fileName = item.meta.fileName || item.meta.title;
                            const ext = getFileExtension(fileName);
                            const isDownloading = downloadingId === item.raw.id;
                            const pKind = getPreviewKind(item);
                            return (
                              <div className={styles.attachmentCard}>
                                <div className={styles.fileIconWrap} aria-hidden="true">
                                  <DarkFileBadge ext={ext} />
    </div>
                                <div className={styles.attachmentMeta}>
                                  <div className={styles.attachmentName} title={fileName}>
                                    {fileName}
    </div>
                                  <div className={styles.attachmentSub}>
                                    {formatBytes(item.raw.size_bytes)} · {FREE_EXPIRY_DAYS}d left
    </div>
    </div>
                                <div className={styles.bubbleIconRow}>
                                  {pKind && (
                                    <button
                                      type="button"
                                      className={styles.bubbleIconBtn}
                                      title="Preview"
                                      aria-label={`Preview ${fileName}`}
                                      onClick={() => void handlePreview(item)}
                                    >
                                      <Eye size={15} aria-hidden="true" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className={`${styles.bubbleIconBtn} ${styles.bubbleIconBtnPrimary}`}
                                    title={isDownloading ? 'Saving…' : 'Save'}
                                    aria-label={isDownloading ? `Saving ${fileName}` : `Save ${fileName}`}
                                    disabled={isDownloading}
                                    onClick={() => void handleDownload(item)}
                                  >
                                    {isDownloading ? (
                                      <Loader size={13} color="currentColor" />
                                    ) : (
                                      <ArrowDownToLine
                                        size={15}
                                        strokeWidth={2.2}
                                        aria-hidden="true"
                                      />
                                    )}
                                  </button>
                                </div>
    </div>
                            );
                          })()}

                        <div className={styles.bubbleFooter}>
                          <span>{formatTime(item.raw.created_at)}</span>
    </div>
    </div>

                      {!isSelf && actions}
                      </div>
    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </>
          )}
    </div>

        {(filter === 'all' ||
          filter === 'file' ||
          filter === 'media' ||
          uploadStatus !== null) && (
          <div className={styles.composerDock}>
            {uploadStatus !== null && (
              <div className={styles.uploadStatusCard} role="status" aria-live="polite">
                <div className={styles.uploadStatusTop}>
                  <div className={styles.uploadStatusLeft}>
                    <Loader size={14} color="#2dd4bf" />
                    <span className={styles.uploadStatusName}>
                      {uploadStatus.fileName} ({formatBytes(uploadStatus.sizeBytes)})
                    </span>
                  </div>
                  <span className={styles.uploadStatusMeta}>
                    {uploadStatus.stage} · {uploadStatus.pct}%
                  </span>
                </div>
                <div className={styles.uploadStatusTrack}>
                  <div
                    className={styles.uploadStatusFill}
                    style={{ width: `${uploadStatus.pct}%` }}
                  />
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={filter === 'media' ? 'image/*,video/*' : undefined}
              className={styles.hiddenInput}
              onChange={(e) => {
                void handleSendFiles(e.currentTarget.files);
                e.currentTarget.value = '';
              }}
            />
            <input
              ref={mediaInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className={styles.hiddenInput}
              onChange={(e) => {
                void handleSendFiles(e.currentTarget.files);
                e.currentTarget.value = '';
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              className={styles.hiddenInput}
              onChange={(e) => {
                void handleSendFiles(e.currentTarget.files);
                e.currentTarget.value = '';
              }}
            />
            <input
              ref={docsInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.json,.zip,.rar,.7z,.tar,.gz,.mp3,.wav,.m4a,.svg,application/*,text/*,audio/*"
              className={styles.hiddenInput}
              onChange={(e) => {
                void handleSendFiles(e.currentTarget.files);
                e.currentTarget.value = '';
              }}
            />

            {filter === 'all' ? (
              <div className={styles.composerBar}>
                <div className={styles.attachMenuWrap} ref={attachMenuWrapRef}>
                  {attachMenuOpen && (
                    <div
                      className={styles.attachPopover}
                      role="menu"
                      aria-label="Attach to My Lyga"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className={styles.attachPopoverItem}
                        onClick={() => {
                          setAttachMenuOpen(false);
                          mediaInputRef.current?.click();
                        }}
                      >
                        <span className={styles.attachPopoverIcon} aria-hidden="true">
                          <ImageIcon size={16} />
                        </span>
                        <span>Photos &amp; Videos</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className={styles.attachPopoverItem}
                        onClick={() => {
                          setAttachMenuOpen(false);
                          cameraInputRef.current?.click();
                        }}
                      >
                        <span className={styles.attachPopoverIcon} aria-hidden="true">
                          <Camera size={16} />
                        </span>
                        <span>Take Photo or Video</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className={styles.attachPopoverItem}
                        onClick={() => {
                          setAttachMenuOpen(false);
                          docsInputRef.current?.click();
                        }}
                      >
                        <span className={styles.attachPopoverIcon} aria-hidden="true">
                          <FileText size={16} />
                        </span>
                        <span>Browse Files</span>
                      </button>
                      <div className={styles.attachPopoverDivider} role="separator" />
                      <button
                        type="button"
                        role="menuitem"
                        className={styles.attachPopoverItem}
                        onClick={() => void handlePasteFromClipboard()}
                      >
                        <span className={styles.attachPopoverIcon} aria-hidden="true">
                          <ClipboardPaste size={16} />
                        </span>
                        <span>Paste from Clipboard</span>
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    className={`${styles.attachBtn} ${attachMenuOpen ? styles.attachBtnOpen : ''}`}
                    aria-label={attachMenuOpen ? 'Close attachment menu' : 'Open attachment menu'}
                    aria-expanded={attachMenuOpen}
                    aria-haspopup="menu"
                    disabled={sending}
                    onClick={() => {
                      textareaRef.current?.blur();
                      setAttachMenuOpen((prev) => !prev);
                    }}
                  >
                    <Plus size={18} />
                  </button>
                </div>

                <textarea
                  ref={textareaRef}
                  rows={1}
                  aria-label="Send a note, link, or file"
                  className={styles.composerInput}
                  placeholder="Send a note, link, or file…"
                  value={draft}
                  onChange={(e) => setDraft(e.currentTarget.value)}
                  onPaste={(e) => {
                    const files: File[] = [];
                    for (const item of Array.from(e.clipboardData?.items ?? [])) {
                      if (item.kind === 'file') {
                        const f = item.getAsFile();
                        if (f) files.push(f);
                      }
                    }
                    if (files.length > 0) {
                      e.preventDefault();
                      const dt = new DataTransfer();
                      files.forEach((f) => dt.items.add(f));
                      void handleSendFiles(dt.files);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSendText();
                    }
                  }}
                />

                <button
                  type="button"
                  className={styles.sendBtn}
                  aria-label="Send message"
                  disabled={sending || !draft.trim()}
                  onClick={() => void handleSendText()}
                >
                  <span>Send ↵</span>
                </button>
    </div>
            ) : (filter === 'file' || filter === 'media') ? (
              <div className={styles.uploadDockBar}>
                <span className={styles.uploadDockText}>
                  Drop {filter === 'media' ? 'photos or 4K videos' : 'files'} anywhere here to
                  encrypt &amp; upload
                </span>
                <button
                  type="button"
                  className={styles.uploadDockBtn}
                  disabled={sending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud size={15} aria-hidden="true" />
                  <span>{filter === 'media' ? 'Upload Media' : 'Upload Files'}</span>
                </button>
    </div>
            ) : null}
    </div>
        )}
      </section>

      <aside className={styles.rail} aria-label="Workspace devices and pairing">
        <div className={styles.railHeaderBar}>
          {renderAccountMenu(accountMenuDesktopRef, true)}
        </div>
        {renderPinnedSection()}
        <div className={styles.railHairline} />
        {renderStorageCard()}
        <div className={styles.railHairline} />
        {renderDeviceCard()}
      </aside>

      <Modal
        opened={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        title="Devices & pairing"
        centered
        classNames={{
          content: styles.darkModalContent,
          header: styles.darkModalHeader,
          title: styles.darkModalTitle,
          close: styles.darkModalClose,
          body: styles.darkModalBody,
        }}
      >
        <div className={styles.mobileModalStack}>
          {renderStorageCard()}
          <div className={styles.railHairline} />
          {renderPinnedSection()}
          <div className={styles.railHairline} />
          {renderDeviceCard()}
    </div>
      </Modal>

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
    </div>
  );
}

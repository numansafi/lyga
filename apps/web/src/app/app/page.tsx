'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, Loader, Modal, Progress } from '@mantine/core';
import {
  ArrowDownToLine,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  ExternalLink,
  Eye,
  LayoutGrid,
  Link2,
  List,
  Lock,
  LogOut,
  Pencil,
  Pin,
  Plus,
  QrCode,
  Search,
  Send,
  ShieldCheck,
  Square,
  StickyNote,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  FileIcon as ReactFileIcon,
  defaultStyles,
  type DefaultExtensionType,
} from 'react-file-icon';
import { LygaQrCode } from '@/components/LygaQrCode';
import {
  FREE_MAX_STORAGE_BYTES,
  type FeedItemKind,
  type FeedItemRecord,
  type WorkspaceRecord,
} from '@/lib/mvp/constants';
import {
  classifyFileKind,
  classifyTextKind,
  decryptFileChunked,
  decryptString,
  encryptFileChunked,
  encryptString,
  generateWorkspaceKey,
  importWorkspaceKey,
  type DecryptedItemMeta,
} from '@/lib/mvp/crypto';
import { getSavedDeviceName, saveDeviceName } from '@/lib/mvp/device-label';
import { getWorkspaceKey, saveWorkspaceKey } from '@/lib/mvp/key-store';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import styles from './Workspace.module.css';

type TabFilter = 'all' | FeedItemKind;

interface DecryptedFeedItem {
  raw: FeedItemRecord;
  meta: DecryptedItemMeta;
  bodyText: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function getDateGroupLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Earlier';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfDay) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function getFileExtension(fileName?: string): string {
  const match = (fileName ?? '').toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return match?.[1] ?? 'file';
}

type PreviewKind = 'image' | 'video' | 'pdf' | 'text' | null;

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif']);
const VIDEO_EXTS = new Set(['mp4', 'mov', 'webm', 'm4v']);
const TEXT_EXTS = new Set(['txt', 'md', 'json', 'csv', 'log', 'ts', 'tsx', 'js', 'jsx', 'py', 'css', 'html', 'yml', 'yaml', 'xml']);

function getPreviewKind(item: DecryptedFeedItem): PreviewKind {
  const mime = (item.meta.mimeType ?? '').toLowerCase();
  const ext = getFileExtension(item.meta.fileName || item.meta.title);
  if (mime.startsWith('image/') || IMAGE_EXTS.has(ext)) return 'image';
  if (mime.startsWith('video/') || VIDEO_EXTS.has(ext)) return 'video';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('text/') || mime === 'application/json' || TEXT_EXTS.has(ext)) return 'text';
  return null;
}

function isSafeHttpUrl(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

function getLinkPreviewInfo(rawUrl: string): {
  safeHref: string;
  hostname: string;
  pathLabel: string;
  faviconUrl: string;
  youtubeThumbUrl: string | null;
  youtubeEmbedUrl: string | null;
} | null {
  try {
    const safeHref = isSafeHttpUrl(rawUrl);
    if (!safeHref) return null;
    const parsed = new URL(safeHref);
    const hostname = parsed.hostname.replace(/^www\./, '');
    const pathPart = `${parsed.pathname === '/' ? '' : parsed.pathname}${parsed.search}`;
    const pathLabel = pathPart ? (pathPart.length > 52 ? `${pathPart.slice(0, 52)}…` : pathPart) : hostname;
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;

    let ytId: string | null = null;
    if (hostname === 'youtu.be') {
      ytId = parsed.pathname.slice(1).split('/')[0] || null;
    } else if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      if (parsed.pathname.startsWith('/shorts/')) {
        ytId = parsed.pathname.split('/')[2] || null;
      } else {
        ytId = parsed.searchParams.get('v');
      }
    }
    const validYt = ytId && /^[a-zA-Z0-9_-]{6,20}$/.test(ytId) ? ytId : null;
    const youtubeThumbUrl = validYt ? `https://i.ytimg.com/vi/${validYt}/hqdefault.jpg` : null;
    const youtubeEmbedUrl = validYt
      ? `https://www.youtube-nocookie.com/embed/${validYt}?autoplay=1`
      : null;

    return { safeHref, hostname, pathLabel, faviconUrl, youtubeThumbUrl, youtubeEmbedUrl };
  } catch {
    return null;
  }
}

function getFileIconProps(ext: string) {
  const preset = defaultStyles[ext as DefaultExtensionType];
  if (!preset) {
    return {
      extension: ext,
      color: '#f0fdfa',
      foldColor: '#99f6e4',
      labelColor: '#115e59',
      glyphColor: '#115e59',
    };
  }
  return {
    extension: ext,
    ...preset,
    foldColor: '#cbd5e1',
    glyphColor: preset.labelColor ?? '#115e59',
  };
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
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [previewItem, setPreviewItem] = useState<DecryptedFeedItem | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [copiedImageId, setCopiedImageId] = useState<string | null>(null);
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [mediaView, setMediaView] = useState<'grid' | 'list'>('grid');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<DecryptedFeedItem | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
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
            const metaJson = await decryptString(key, raw.encrypted_meta);
            const meta = JSON.parse(metaJson) as DecryptedItemMeta;
            const bodyText = raw.encrypted_body
              ? await decryptString(key, raw.encrypted_body)
              : null;
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
    setSelectMode(false);
    setSelectedIds([]);
  }, [filter]);

  useEffect(() => {
    if (!workspaceId) return;
    const es = new EventSource('/api/mvp/events');
    es.addEventListener('refresh', () => {
      void loadWorkspace();
    });

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadWorkspace();
      }
    };

    const pollTimer = window.setInterval(refreshIfVisible, 4000);
    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);
    window.addEventListener('online', refreshIfVisible);

    return () => {
      es.close();
      window.clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
      window.removeEventListener('online', refreshIfVisible);
    };
  }, [workspaceId, loadWorkspace]);

  useEffect(() => {
    if (filter === 'all') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [items.length, filter]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(140, el.scrollHeight)}px`;
  }, [draft]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    let prevHeight = vv.height;

    const syncViewport = () => {
      root.style.setProperty('--app-height', `${vv.height}px`);
      root.style.setProperty('--app-offset-top', `${vv.offsetTop}px`);
      if (vv.height < prevHeight - 80 && filter === 'all') {
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'auto' });
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
      root.style.removeProperty('--app-height');
      root.style.removeProperty('--app-offset-top');
    };
  }, [filter]);

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

    for (const file of Array.from(fileList)) {
      setSending(true);
      setUploadStatus({
        fileName: file.name,
        sizeBytes: file.size,
        stage: 'Preparing',
        pct: 5,
      });
      try {
        const prepRes = await fetch('/api/mvp/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sizeBytes: file.size }),
        });

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

        const kind = classifyFileKind(file.type, file.name);
        const meta: DecryptedItemMeta = {
          title: file.name,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          senderDeviceId: deviceId ?? undefined,
          senderLabel: myDeviceName,
        };
        const encryptedMeta = await encryptString(cryptoKey, JSON.stringify(meta));

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

        setUploadStatus({
          fileName: file.name,
          sizeBytes: file.size,
          stage: 'Saving',
          pct: 100,
        });
        await loadWorkspace();
      } finally {
        setSending(false);
        setUploadStatus(null);
      }
    }
  };

  const getDecryptedBlobUrl = useCallback(
    async (item: DecryptedFeedItem): Promise<string | null> => {
      if (!cryptoKey || !item.raw.blob_key) return null;
      const existing = previewUrlsRef.current[item.raw.id];
      if (existing) return existing;

      const inflight = previewInFlightRef.current.get(item.raw.id);
      if (inflight) return inflight;

      const task = (async () => {
        try {
          const urlRes = await fetch(`/api/mvp/download-url?id=${encodeURIComponent(item.raw.id)}`);
          if (!urlRes.ok) return null;
          const { downloadUrl } = (await urlRes.json()) as { downloadUrl: string };
          const blobRes = await fetch(downloadUrl);
          if (!blobRes.ok) return null;
          const encBuf = await blobRes.arrayBuffer();
          const plainBlob = await decryptFileChunked(
            cryptoKey,
            encBuf,
            item.meta.mimeType || 'application/octet-stream'
          );
          const objectUrl = URL.createObjectURL(plainBlob);
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
    [cryptoKey]
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

  const handleDownload = async (item: DecryptedFeedItem) => {
    if (!cryptoKey || !item.raw.blob_key) return;
    setDownloadingId(item.raw.id);
    setErrorMsg(null);
    try {
      const objectUrl = await getDecryptedBlobUrl(item);
      if (!objectUrl) {
        setErrorMsg('Failed to decrypt downloaded file.');
        return;
      }
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = item.meta.fileName || 'lyga-download';
      document.body.appendChild(a);
      a.click();
      a.remove();
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
    const targets = [...selectedIds];
    setSelectedIds([]);
    setSelectMode(false);
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
    setSelectMode(false);
  };

  const handleDelete = async (id: string) => {
    const prevItems = items;
    const prevUsedBytes = usedBytes;
    const target = prevItems.find((it) => it.raw.id === id);

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

    const res = await fetch(`/api/mvp/items?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) {
      setItems(prevItems);
      setUsedBytes(prevUsedBytes);
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

  const counts = useMemo(() => {
    const map: Record<FeedItemKind, number> = {
      media: 0,
      link: 0,
      code: 0,
      file: 0,
      text: 0,
    };
    for (const it of items) {
      map[it.raw.kind] += 1;
    }
    return map;
  }, [items]);

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

  const deviceOptions = useMemo(() => {
    const peerDots = ['#38bdf8', '#a78bfa', '#fbbf24', '#fb7185'];
    const opts: Array<{ id: string; label: string; dotColor: string }> = [];
    if (deviceId) {
      opts.push({ id: deviceId, label: myDeviceName, dotColor: '#2dd4bf' });
    }
    let slot = 0;
    const seen = new Set<string>(deviceId ? [deviceId] : []);

    for (const dev of devices) {
      if (!seen.has(dev.id)) {
        seen.add(dev.id);
        opts.push({
          id: dev.id,
          label: dev.label,
          dotColor: peerDots[slot % peerDots.length],
        });
        slot += 1;
      }
    }

    for (const it of items) {
      const sid = it.meta.senderDeviceId;
      if (sid && !seen.has(sid)) {
        seen.add(sid);
        opts.push({
          id: sid,
          label: it.meta.senderLabel || 'Paired device',
          dotColor: peerDots[slot % peerDots.length],
        });
        slot += 1;
      }
    }

    return opts;
  }, [devices, deviceId, items, myDeviceName]);

  const categoryGroups = useMemo(() => {
    if (filter === 'all') return [];
    const q = searchQuery.trim().toLowerCase();
    const effectiveSort =
      sortBy === 'largest' && filter !== 'file' && filter !== 'media' ? 'newest' : sortBy;

    const matching = items.filter((it) => {
      if (it.raw.kind !== filter) return false;
      const senderId = it.meta.senderDeviceId ?? deviceId ?? '';
      if (deviceFilter !== 'all' && senderId !== deviceFilter) return false;
      if (q) {
        const hay = `${it.meta.fileName ?? ''} ${it.meta.title ?? ''} ${it.bodyText ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...matching].sort((a, b) => {
      if (effectiveSort === 'largest') return b.raw.size_bytes - a.raw.size_bytes;
      if (effectiveSort === 'oldest') return a.raw.created_at.localeCompare(b.raw.created_at);
      return b.raw.created_at.localeCompare(a.raw.created_at);
    });

    const pinnedSet = new Set(pinnedIds);
    const pinnedItems = sorted.filter((it) => pinnedSet.has(it.raw.id));

    const groups: Array<{ label: string; items: DecryptedFeedItem[] }> = [];
    if (pinnedItems.length > 0) {
      groups.push({ label: 'Pinned', items: pinnedItems });
    }

    if (effectiveSort === 'largest') {
      if (sorted.length > 0) {
        groups.push({ label: 'Largest first', items: sorted });
      }
      return groups;
    }

    for (const it of sorted) {
      const label = getDateGroupLabel(it.raw.created_at);
      const last = groups[groups.length - 1];
      if (last && last.label !== 'Pinned' && last.label === label) {
        last.items.push(it);
      } else {
        groups.push({ label, items: [it] });
      }
    }
    return groups;
  }, [deviceFilter, deviceId, filter, items, pinnedIds, searchQuery, sortBy]);

  const storagePct = Math.min(100, Math.round((usedBytes / FREE_MAX_STORAGE_BYTES) * 100));

  const renderQrCard = () => (
    <div className={styles.qrCard}>
      <div className={styles.qrHero}>
        <span
          className={`${styles.qrStatusPill} ${
            deviceCount >= 2 ? styles.qrStatusPillConnected : ''
          }`}
        >
          <span className={styles.qrPulseDot} aria-hidden="true" />
          {deviceCount >= 2 ? 'Phone connected' : 'Ready to scan'}
        </span>

        <div className={styles.qrStage}>
          <span className={`${styles.cornerBracket} ${styles.cornerTL}`} aria-hidden="true" />
          <span className={`${styles.cornerBracket} ${styles.cornerTR}`} aria-hidden="true" />
          <span className={`${styles.cornerBracket} ${styles.cornerBL}`} aria-hidden="true" />
          <span className={`${styles.cornerBracket} ${styles.cornerBR}`} aria-hidden="true" />

          <div className={styles.qrBox}>
            <LygaQrCode value={pairUrl} size={184} />
    </div>
    </div>
    </div>

      <div className={styles.qrBody}>
        <div className={styles.qrTitle}>Scan to connect your phone</div>
        <p className={styles.qrDesc}>
          Point your camera at the code. Your encryption key stays on your devices only.
        </p>
        {workspace && (
          <div className={styles.pairCodePill}>
            <Lock size={12} aria-hidden="true" />
            <span className={styles.pairCodeLabel}>Code</span>
            <span>
              {workspace.pair_code.length === 8
                ? `${workspace.pair_code.slice(0, 4)} ${workspace.pair_code.slice(4)}`
                : workspace.pair_code}
            </span>
    </div>
        )}
        <Button
          size="sm"
          variant="light"
          fullWidth
          className={styles.copyPairBtn}
          leftSection={pairCopied ? <Check size={14} /> : <Copy size={14} />}
          disabled={!pairUrl}
          onClick={() => {
            void navigator.clipboard.writeText(pairUrl);
            setPairCopied(true);
            window.setTimeout(() => setPairCopied(false), 1400);
          }}
        >
          {pairCopied ? 'Pair link copied' : 'Copy pair link'}
        </Button>
    </div>
    </div>
  );

  const renderDeviceCard = () => (
    <div className={styles.deviceCard}>
      <div className={styles.deviceRow}>
        <span className={styles.deviceHeading}>This device</span>
        {!editingName && deviceId && (
          <button
            type="button"
            className={styles.deviceIconBtn}
            aria-label="Rename this device"
            onClick={() => {
              setNameDraft(myDeviceName);
              setEditingName(true);
            }}
          >
            <Pencil size={13} />
          </button>
        )}
    </div>
      {editingName && deviceId ? (
        <form
          className={styles.deviceEditRow}
          onSubmit={(e) => {
            e.preventDefault();
            setMyDeviceName(saveDeviceName(deviceId, nameDraft));
            setEditingName(false);
          }}
        >
          <input
            type="text"
            className={styles.deviceInput}
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
      ) : (
        <div className={styles.deviceName}>{myDeviceName}</div>
      )}

      {devices.length > 0 && (
        <div className={styles.devicesList}>
          {devices.map((dev) => {
            const isCurrent = dev.id === deviceId;
            const opt = deviceOptions.find((o) => o.id === dev.id);
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
                {!isCurrent && (
                  <button
                    type="button"
                    className={styles.removeDevBtn}
                    aria-label={`Remove ${label}`}
                    onClick={() => void handleRemoveDevice(dev.id)}
                  >
                    <X size={13} />
                  </button>
                )}
    </div>
            );
          })}
    </div>
      )}

      <button
        type="button"
        className={styles.recoveryBtn}
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

      <div className={styles.accountRow}>
        <span className={styles.accountEmail}>{userEmail ?? 'Signed in'}</span>
        <button
          type="button"
          className={styles.signOutBtn}
          onClick={() => {
            void (async () => {
              await getSupabaseBrowser()?.auth.signOut().catch(() => undefined);
              await fetch('/api/auth/session', { method: 'DELETE' });
              router.replace('/login');
            })();
          }}
        >
          <LogOut size={12} aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  const renderStorageCard = () => (
    <div className={styles.storageCard}>
      <div className={styles.storageRow}>
        <span>Storage</span>
        <span>{formatBytes(usedBytes)} / 2.00 GB</span>
    </div>
      <Progress value={storagePct} color="spruce" size="xs" />
      <button
        type="button"
        className={styles.upgradeLink}
        onClick={() => setErrorMsg('Pro (£5/mo — 100 GB & 5 GB files) is coming soon.')}
      >
        Lock in 100 GB &amp; 5 GB files (£5/mo) →
      </button>
    </div>
  );

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
            <div>
              <div className={styles.chatTitle}>My Feed</div>
              <div className={styles.chatSub}>
                <span className={styles.chatSubEncrypted}>
                  <Lock size={11} aria-hidden="true" />
                  End-to-end encrypted
                </span>
                <span>·</span>
                <span>
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

            <Button
              size="xs"
              variant="light"
              className={styles.mobilePairBtn}
              leftSection={<QrCode size={14} />}
              onClick={() => setQrModalOpen(true)}
            >
              Pair
            </Button>
    </div>
        </header>

        <div className={styles.messageStream}>
          {filter !== 'all' ? (
            <div className={styles.categoryView}>
              <div className={styles.categoryToolbar}>
                <div className={styles.searchBox}>
                  <Search size={14} aria-hidden="true" />
                  <input
                    type="search"
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
                      <button
                        type="button"
                        className={`${styles.sortBtn} ${mediaView === 'grid' ? styles.sortBtnActive : ''}`}
                        aria-label={mediaView === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
                        onClick={() => setMediaView((v) => (v === 'grid' ? 'list' : 'grid'))}
                      >
                        {mediaView === 'grid' ? <LayoutGrid size={13} /> : <List size={13} />}
                      </button>
                    )}
                    <button
                      type="button"
                      className={`${styles.sortBtn} ${selectMode ? styles.sortBtnActive : ''}`}
                      onClick={() => {
                        setSelectMode((v) => !v);
                        setSelectedIds([]);
                      }}
                    >
                      <CheckSquare size={13} />
                      <span>Select</span>
                    </button>
    </div>
    </div>

                {selectMode && (
                  <div className={styles.bulkBar}>
                    <span className={styles.bulkCount}>{selectedIds.length} selected</span>
                    <div className={styles.bulkActions}>
                      {(filter === 'file' || filter === 'media') && (
                        <button
                          type="button"
                          className={styles.previewBtn}
                          disabled={selectedIds.length === 0}
                          onClick={() => void handleBulkDownload()}
                        >
                          <ArrowDownToLine size={13} />
                          <span>Save</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.bulkDeleteBtn}
                        disabled={selectedIds.length === 0}
                        onClick={() => void handleBulkDelete()}
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
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
                                className={styles.mediaTilePreview}
                                onClick={() =>
                                  selectMode ? toggleSelect(item.raw.id) : void handlePreview(item)
                                }
                              >
                                {thumbUrl ? (
                                  <img
                                    src={thumbUrl}
                                    alt={item.meta.fileName || item.meta.title}
                                    className={styles.mediaTileImg}
                                  />
                                ) : (
                                  <div className={styles.mediaTileFallback}>
                                    <ReactFileIcon {...getFileIconProps(ext)} />
    </div>
                                )}
                              </button>
                              <div className={styles.mediaTileBar}>
                                <span className={styles.mediaTileName}>
                                  {item.meta.fileName || item.meta.title}
                                </span>
                                <div className={styles.mediaTileBtns}>
                                  {selectMode ? (
                                    <button
                                      type="button"
                                      className={styles.actionIconBtn}
                                      aria-label="Select item"
                                      onClick={() => toggleSelect(item.raw.id)}
                                    >
                                      {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                                    </button>
                                  ) : (
                                    <>
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
                                    </>
                                  )}
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
                        const senderOpt = deviceOptions.find((d) => d.id === senderId);
                        const senderName = isSelf
                          ? myDeviceName
                          : item.meta.senderLabel || senderOpt?.label || 'Paired device';
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
                          <div key={item.raw.id} className={styles.groupRow}>
                            <div className={styles.groupRowLeft}>
                              {selectMode && (
                                <button
                                  type="button"
                                  className={styles.actionIconBtn}
                                  aria-label="Select item"
                                  onClick={() => toggleSelect(item.raw.id)}
                                >
                                  {isSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                                </button>
                              )}
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
                                    <ReactFileIcon {...getFileIconProps(ext)} />
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
                    item.meta.senderLabel ||
                    devices.find((d) => d.id === item.meta.senderDeviceId)?.label ||
                    'Paired device';

                  return (
                    <div
                      key={item.raw.id}
                      className={`${styles.msgRow} ${isSelf ? styles.msgOut : styles.msgIn}`}
                    >
                      {isSelf && actions}

                      <div className={isSelf ? styles.bubbleOut : `${styles.bubbleIn} ${peerClass}`}>
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
                            const ext = getFileExtension(item.meta.fileName || item.meta.title);
                            const isDownloading = downloadingId === item.raw.id;
                            const pKind = getPreviewKind(item);
                            return (
                              <div className={styles.attachmentCard}>
                                <div className={styles.fileIconWrap} aria-hidden="true">
                                  <ReactFileIcon {...getFileIconProps(ext)} />
    </div>
                                <div className={styles.attachmentMeta}>
                                  <div className={styles.attachmentName}>
                                    {item.meta.fileName || item.meta.title}
    </div>
                                  <div className={styles.attachmentSub}>
                                    {formatBytes(item.raw.size_bytes)} · Original quality · 7d
    </div>
    </div>
                                {pKind && (
                                  <button
                                    type="button"
                                    className={styles.previewBtn}
                                    aria-label={`Preview ${item.meta.fileName || item.meta.title}`}
                                    onClick={() => void handlePreview(item)}
                                  >
                                    <Eye size={14} aria-hidden="true" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className={isSelf ? styles.saveBtnOut : styles.saveBtnIn}
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
    </div>
                            );
                          })()}

                        <div className={styles.bubbleFooter}>
                          <span>{formatTime(item.raw.created_at)}</span>
    </div>
    </div>

                      {!isSelf && actions}
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
          errorMsg ||
          uploadStatus !== null) && (
          <div className={styles.composerDock}>
            {errorMsg && (
              <Alert color="red" withCloseButton onClose={() => setErrorMsg(null)}>
                {errorMsg}
              </Alert>
            )}

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

            {filter === 'all' ? (
              <div className={styles.composerBar}>
                <button
                  type="button"
                  className={styles.attachBtn}
                  aria-label="Attach file"
                  disabled={sending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Plus size={18} />
                </button>

                <textarea
                  ref={textareaRef}
                  rows={1}
                  className={styles.composerInput}
                  placeholder="Text yourself anything — links, 4K clips, screenshots…"
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
        <div className={styles.railTop}>
          <Link href="/" className={styles.brandLink}>
            Lyga
          </Link>
          <Button
            size="xs"
            variant="light"
            onClick={() => setErrorMsg('Pro (£5/mo — 100 GB & 5 GB files) is coming soon.')}
          >
            Pro £5/mo
          </Button>
    </div>

        {renderQrCard()}
        {renderDeviceCard()}
        {renderStorageCard()}
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
          {renderQrCard()}
          {renderDeviceCard()}
          {renderStorageCard()}
    </div>
      </Modal>

      <Modal
        opened={Boolean(previewItem)}
        onClose={() => {
          setPreviewItem(null);
          setPreviewText(null);
        }}
        title={previewItem?.meta.fileName || previewItem?.meta.title || 'Preview'}
        size="lg"
        centered
        classNames={{
          content: styles.darkModalContent,
          header: styles.darkModalHeader,
          title: styles.darkModalTitle,
          close: styles.darkModalClose,
          body: styles.darkModalBody,
        }}
      >
        {previewItem &&
          (() => {
            const isLink = previewItem.raw.kind === 'link';
            const linkInfo =
              isLink && previewItem.bodyText ? getLinkPreviewInfo(previewItem.bodyText) : null;
            const pKind = isLink ? null : getPreviewKind(previewItem);
            const url = isLink ? null : previewUrls[previewItem.raw.id];
            const openHref = isLink ? (linkInfo?.safeHref ?? undefined) : url;
            return (
              <div className={styles.previewModalBody}>
                {isLink && linkInfo?.youtubeEmbedUrl ? (
                  <iframe
                    src={linkInfo.youtubeEmbedUrl}
                    title={previewItem.bodyText || 'YouTube preview'}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className={styles.previewFrame}
                  />
                ) : previewLoading && !url ? (
                  <div className={styles.previewLoadingBox}>
                    <Loader color="spruce" size="md" />
                    <span>Decrypting preview…</span>
    </div>
                ) : !url ? (
                  <div className={styles.previewLoadingBox}>
                    <span>Preview unavailable. Use Save to download the file.</span>
    </div>
                ) : pKind === 'image' ? (
                  <img
                    src={url}
                    alt={previewItem.meta.fileName || previewItem.meta.title}
                    className={styles.previewMedia}
                  />
                ) : pKind === 'video' ? (
                  <video src={url} controls playsInline className={styles.previewVideo} />
                ) : pKind === 'pdf' ? (
                  <iframe
                    src={url}
                    title={previewItem.meta.fileName || 'PDF preview'}
                    className={styles.previewFrame}
                  />
                ) : pKind === 'text' ? (
                  <pre className={styles.previewCode}>{previewText ?? 'Loading…'}</pre>
                ) : null}

                <div className={styles.previewFooter}>
                  <div className={styles.previewNavGroup}>
                    {previewableItems.length > 1 && (
                      <>
                        <button
                          type="button"
                          className={styles.previewBtn}
                          aria-label="Previous item"
                          onClick={() => stepPreview(-1)}
                        >
                          <ChevronLeft size={14} aria-hidden="true" />
                        </button>
                        <span className={styles.previewMetaText}>
                          {previewIndex + 1} / {previewableItems.length}
                        </span>
                        <button
                          type="button"
                          className={styles.previewBtn}
                          aria-label="Next item"
                          onClick={() => stepPreview(1)}
                        >
                          <ChevronRight size={14} aria-hidden="true" />
                        </button>
                      </>
                    )}
                    {!isLink && (
                      <span className={styles.previewMetaText}>
                        {formatBytes(previewItem.raw.size_bytes)} · Original quality
                      </span>
                    )}
    </div>
                  <div className={styles.previewActionsGroup}>
                    {pKind === 'image' && url && (
                      <button
                        type="button"
                        className={styles.previewBtn}
                        onClick={() => void handleCopyImage(previewItem)}
                      >
                        {copiedImageId === previewItem.raw.id ? (
                          <Check size={13} aria-hidden="true" />
                        ) : (
                          <Copy size={13} aria-hidden="true" />
                        )}
                        <span>{copiedImageId === previewItem.raw.id ? 'Copied' : 'Copy image'}</span>
                      </button>
                    )}
                    {openHref && (
                      <a
                        href={openHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.previewBtn}
                      >
                        <ExternalLink size={13} aria-hidden="true" />
                        <span>Open</span>
                      </a>
                    )}
                    {!isLink && (
                      <button
                        type="button"
                        className={styles.saveBtnIn}
                        disabled={downloadingId === previewItem.raw.id}
                        onClick={() => void handleDownload(previewItem)}
                      >
                        <ArrowDownToLine size={14} strokeWidth={2.2} aria-hidden="true" />
                        <span>{downloadingId === previewItem.raw.id ? 'Saving…' : 'Save'}</span>
                      </button>
                    )}
    </div>
    </div>
    </div>
            );
          })()}
      </Modal>
      <Modal
        opened={Boolean(editingItem)}
        onClose={() => {
          setEditingItem(null);
          setEditDraft('');
        }}
        title="Edit message"
        centered
        classNames={{
          content: styles.darkModalContent,
          header: styles.darkModalHeader,
          title: styles.darkModalTitle,
          close: styles.darkModalClose,
          body: styles.darkModalBody,
        }}
      >
        <div className={styles.previewModalBody}>
          <textarea
            rows={5}
            className={styles.editTextarea}
            value={editDraft}
            onChange={(e) => setEditDraft(e.currentTarget.value)}
          />
          <div className={styles.previewFooter}>
            <span className={styles.previewMetaText}>Re-encrypts for all paired devices</span>
            <button
              type="button"
              className={styles.saveBtnIn}
              disabled={savingEdit || !editDraft.trim()}
              onClick={() => void handleSaveEdit()}
            >
              <span>{savingEdit ? 'Saving…' : 'Save changes'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

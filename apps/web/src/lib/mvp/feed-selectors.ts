import { FREE_MAX_STORAGE_BYTES, type FeedItemKind, type FeedItemRecord } from './constants.ts';
import type { DecryptedItemMeta } from './crypto.ts';

export type TabFilter = 'all' | FeedItemKind;
export type PreviewKind = 'image' | 'video' | 'pdf' | 'text' | null;
export type SortMode = 'newest' | 'oldest' | 'largest';

export interface DecryptedFeedItem {
  raw: FeedItemRecord;
  meta: DecryptedItemMeta;
  bodyText: string | null;
}

export interface DeviceOption {
  id: string;
  label: string;
  dotColor: string;
}

export interface LinkPreviewInfo {
  safeHref: string;
  hostname: string;
  pathLabel: string;
  faviconUrl: string;
  youtubeThumbUrl: string | null;
  youtubeEmbedUrl: string | null;
}

export const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif', 'heic', 'heif']);
const VIDEO_EXTS = new Set(['mp4', 'mov', 'webm', 'm4v']);
const TEXT_EXTS = new Set([
  'txt',
  'md',
  'json',
  'csv',
  'log',
  'ts',
  'tsx',
  'js',
  'jsx',
  'py',
  'css',
  'html',
  'yml',
  'yaml',
  'xml',
]);

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function getDateGroupLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Earlier';
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfDay) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getFileExtension(fileName?: string): string {
  const match = (fileName ?? '').toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return match?.[1] ?? 'file';
}

export function getPreviewKind(item: DecryptedFeedItem): PreviewKind {
  const mime = (item.meta.mimeType ?? '').toLowerCase();
  const ext = getFileExtension(item.meta.fileName || item.meta.title);
  if (mime.startsWith('image/') || IMAGE_EXTS.has(ext)) return 'image';
  if (mime.startsWith('video/') || VIDEO_EXTS.has(ext)) return 'video';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('text/') || mime === 'application/json' || TEXT_EXTS.has(ext)) return 'text';
  return null;
}

export function isSafeHttpUrl(raw?: string | null): string | null {
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

export function getLinkPreviewInfo(rawUrl: string): LinkPreviewInfo | null {
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

export function countFeedKinds(items: DecryptedFeedItem[]): Record<FeedItemKind, number> {
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
}

export function buildDeviceOptions(
  devices: Array<{ id: string; label: string }>,
  items: DecryptedFeedItem[],
  deviceId: string | null,
  myDeviceName: string
): DeviceOption[] {
  const peerDots = ['#7dd3fc', '#6ee7b7', '#93c5fd', '#5eead4'];
  const opts: DeviceOption[] = [];
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
}

export function buildCategoryGroups(params: {
  filter: TabFilter;
  items: DecryptedFeedItem[];
  searchQuery: string;
  sortBy: SortMode;
  deviceFilter: string;
  deviceId: string | null;
  pinnedIds: string[];
}): Array<{ label: string; items: DecryptedFeedItem[] }> {
  const { filter, items, searchQuery, sortBy, deviceFilter, deviceId, pinnedIds } = params;
  if (filter === 'all') return [];
  const q = searchQuery.trim().toLowerCase();
  const effectiveSort =
    sortBy === 'largest' && filter !== 'file' && filter !== 'media' ? 'newest' : sortBy;

  const matching = items.filter((it) => {
    const kindMatches =
      filter === 'text'
        ? it.raw.kind === 'text' || it.raw.kind === 'code'
        : it.raw.kind === filter;
    if (!kindMatches) return false;
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
}

export function computeVaultBreakdown(items: DecryptedFeedItem[]) {
  let mediaBytes = 0;
  let mediaCount = 0;
  let fileBytes = 0;
  let fileCount = 0;
  let noteBytes = 0;
  let noteCount = 0;
  for (const item of items) {
    const size = Number(item.raw.size_bytes || 0);
    if (item.raw.kind === 'media') {
      mediaBytes += size;
      mediaCount += 1;
    } else if (item.raw.kind === 'file') {
      fileBytes += size;
      fileCount += 1;
    } else {
      noteBytes += size;
      noteCount += 1;
    }
  }
  const pct = (b: number) =>
    b > 0 ? Math.max(2, Math.round((b / FREE_MAX_STORAGE_BYTES) * 1000) / 10) : 0;
  return {
    mediaBytes,
    mediaCount,
    mediaPct: pct(mediaBytes),
    fileBytes,
    fileCount,
    filePct: pct(fileBytes),
    noteBytes,
    noteCount,
    notePct: pct(noteBytes),
  };
}

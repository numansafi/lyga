'use client';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import { Loader } from '@mantine/core';
import {
  ArrowDownToLine,
  Check,
  Copy,
  Eye,
  Link2,
  Lock,
  Pencil,
  Pin,
  Send,
  Trash2,
} from 'lucide-react';
import { DarkFileBadge } from '@/components/mvp/DarkFileBadge';
import {
  formatBytes,
  formatTime,
  getFileExtension,
  getLinkPreviewInfo,
  getPreviewKind,
  type DecryptedFeedItem,
  type DeviceOption,
} from '@/lib/mvp/feed-selectors';
import styles from '@/app/app/Workspace.module.css';

interface WorkspaceStreamProps {
  chronologicalItems: DecryptedFeedItem[];
  deviceId: string | null;
  myDeviceName: string;
  deviceOptionMap: Map<string, DeviceOption>;
  peerColorMap: Map<string, string>;
  pinnedIds: string[];
  togglePin: (id: string) => void;
  copiedId: string | null;
  onCopyText: (id: string, value: string) => void;
  selectedBubbleId: string | null;
  setSelectedBubbleId: Dispatch<SetStateAction<string | null>>;
  downloadingId: string | null;
  workspaceLimits: {
    plan: 'free' | 'pro';
    maxStorageBytes: number;
    expiryDays: number | null;
  };
  onPreview: (item: DecryptedFeedItem) => void;
  onDownload: (item: DecryptedFeedItem) => void;
  onEditItem: (item: DecryptedFeedItem) => void;
  onDeleteItem: (id: string) => void;
  bottomRef: RefObject<HTMLDivElement | null>;
}

export function WorkspaceStream({
  chronologicalItems,
  deviceId,
  myDeviceName,
  deviceOptionMap,
  peerColorMap,
  pinnedIds,
  togglePin,
  copiedId,
  onCopyText,
  selectedBubbleId,
  setSelectedBubbleId,
  downloadingId,
  workspaceLimits,
  onPreview,
  onDownload,
  onEditItem,
  onDeleteItem,
  bottomRef,
}: WorkspaceStreamProps) {
  return (
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
            Send a note, link, code snippet, or drag a 4K video anywhere here. Everything arrives
            encrypted at full original quality.
          </div>
        </div>
      ) : (
        chronologicalItems.map((item) => {
          const kind = item.raw.kind;
          const isFile = kind === 'media' || kind === 'file';
          const copyValue = item.bodyText ?? item.meta.title;
          const matchedActivePeer =
            item.meta.senderDeviceId &&
            item.meta.senderDeviceId !== deviceId &&
            deviceOptionMap.get(item.meta.senderDeviceId)?.label !== myDeviceName;
          const isSelf =
            !item.meta.senderDeviceId ||
            item.meta.senderDeviceId === deviceId ||
            (Boolean(myDeviceName) && item.meta.senderLabel === myDeviceName && !matchedActivePeer);

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
                  onClick={() => onEditItem(item)}
                >
                  <Pencil size={13} />
                </button>
              )}
              {!isFile && (
                <button
                  type="button"
                  className={styles.actionIconBtn}
                  aria-label={copiedId === item.raw.id ? 'Copied' : 'Copy message'}
                  onClick={() => onCopyText(item.raw.id, copyValue)}
                >
                  {copiedId === item.raw.id ? <Check size={14} /> : <Copy size={14} />}
                </button>
              )}
              <button
                type="button"
                className={`${styles.actionIconBtn} ${styles.actionDeleteBtn}`}
                aria-label="Delete message"
                onClick={() => onDeleteItem(item.raw.id)}
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
              className={`${styles.msgRow} ${isSelf ? styles.msgOut : styles.msgIn} ${
                isSelected ? styles.msgSelected : ''
              }`}
            >
              <div className={styles.bubbleCluster}>
                {isSelf && actions}

                <div
                  className={isSelf ? styles.bubbleOut : `${styles.bubbleIn} ${peerClass}`}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button, a, input, textarea')) {
                      return;
                    }
                    setSelectedBubbleId((curr) => (curr === item.raw.id ? null : item.raw.id));
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
                              onClick={() => onPreview(item)}
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
                                  onClick={() => onPreview(item)}
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
                              {formatBytes(item.raw.size_bytes)} ·{' '}
                              {item.raw.expires_at
                                ? `${workspaceLimits.expiryDays ?? 3}d left`
                                : 'Never expires'}
                            </div>
                          </div>
                          <div className={styles.bubbleIconRow}>
                            {pKind && (
                              <button
                                type="button"
                                className={styles.bubbleIconBtn}
                                title="Preview"
                                aria-label={`Preview ${fileName}`}
                                onClick={() => onPreview(item)}
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
                              onClick={() => onDownload(item)}
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
  );
}

'use client';

import { Loader, Modal } from '@mantine/core';
import {
  ArrowDownToLine,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
} from 'lucide-react';
import {
  formatBytes,
  getLinkPreviewInfo,
  getPreviewKind,
  type DecryptedFeedItem,
} from '@/lib/mvp/feed-selectors';
import styles from '@/app/app/Workspace.module.css';

interface WorkspacePreviewModalProps {
  previewItem: DecryptedFeedItem | null;
  previewText: string | null;
  previewLoading: boolean;
  previewUrls: Record<string, string>;
  previewableCount: number;
  previewIndex: number;
  copiedImageId: string | null;
  downloadingId: string | null;
  onClose: () => void;
  onStep: (delta: -1 | 1) => void;
  onCopyImage: (item: DecryptedFeedItem) => void;
  onDownload: (item: DecryptedFeedItem) => void;
}

export function WorkspacePreviewModal({
  previewItem,
  previewText,
  previewLoading,
  previewUrls,
  previewableCount,
  previewIndex,
  copiedImageId,
  downloadingId,
  onClose,
  onStep,
  onCopyImage,
  onDownload,
}: WorkspacePreviewModalProps) {
  const isLink = previewItem?.raw.kind === 'link';
  const linkInfo =
    previewItem && isLink && previewItem.bodyText
      ? getLinkPreviewInfo(previewItem.bodyText)
      : null;
  const pKind = previewItem && !isLink ? getPreviewKind(previewItem) : null;
  const url = previewItem && !isLink ? previewUrls[previewItem.raw.id] : undefined;
  const openHref = isLink ? (linkInfo?.safeHref ?? undefined) : url;

  return (
    <Modal
      opened={Boolean(previewItem)}
      onClose={onClose}
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
      {previewItem && (
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
              {previewableCount > 1 && (
                <>
                  <button
                    type="button"
                    className={styles.previewBtn}
                    aria-label="Previous item"
                    onClick={() => onStep(-1)}
                  >
                    <ChevronLeft size={14} aria-hidden="true" />
                  </button>
                  <span className={styles.previewMetaText}>
                    {previewIndex + 1} / {previewableCount}
                  </span>
                  <button
                    type="button"
                    className={styles.previewBtn}
                    aria-label="Next item"
                    onClick={() => onStep(1)}
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
                  onClick={() => onCopyImage(previewItem)}
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
                  onClick={() => onDownload(previewItem)}
                >
                  <ArrowDownToLine size={14} strokeWidth={2.2} aria-hidden="true" />
                  <span>{downloadingId === previewItem.raw.id ? 'Saving…' : 'Save'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

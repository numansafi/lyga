'use client';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import { Loader } from '@mantine/core';
import {
  Camera,
  ClipboardPaste,
  FileText,
  Image as ImageIcon,
  Plus,
  UploadCloud,
} from 'lucide-react';
import { formatBytes, type TabFilter } from '@/lib/mvp/feed-selectors';
import styles from '@/app/app/Workspace.module.css';

interface UploadStatus {
  fileName: string;
  sizeBytes: number;
  stage: 'Preparing' | 'Encrypting' | 'Uploading' | 'Saving';
  pct: number;
}

interface WorkspaceComposerProps {
  filter: TabFilter;
  sending: boolean;
  draft: string;
  setDraft: (v: string) => void;
  uploadStatus: UploadStatus | null;
  attachMenuOpen: boolean;
  setAttachMenuOpen: Dispatch<SetStateAction<boolean>>;
  attachMenuWrapRef: RefObject<HTMLDivElement | null>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  mediaInputRef: RefObject<HTMLInputElement | null>;
  cameraInputRef: RefObject<HTMLInputElement | null>;
  docsInputRef: RefObject<HTMLInputElement | null>;
  onSendText: () => void;
  onSendFiles: (files: FileList | null) => void;
  onPasteFromClipboard: () => void;
  onCancelUpload: () => void;
}

export function WorkspaceComposer({
  filter,
  sending,
  draft,
  setDraft,
  uploadStatus,
  attachMenuOpen,
  setAttachMenuOpen,
  attachMenuWrapRef,
  textareaRef,
  fileInputRef,
  mediaInputRef,
  cameraInputRef,
  docsInputRef,
  onSendText,
  onSendFiles,
  onPasteFromClipboard,
  onCancelUpload,
}: WorkspaceComposerProps) {
  return (
    <div className={styles.composerDock}>
      {uploadStatus && (
        <div className={styles.uploadStatusCard} role="status" aria-live="polite">
          <div className={styles.uploadStatusTop}>
            <div className={styles.uploadStatusLeft}>
              <Loader size={14} color="#2dd4bf" />
              <span className={styles.uploadStatusName}>
                {uploadStatus.fileName} ({formatBytes(uploadStatus.sizeBytes)})
              </span>
            </div>
            <div className={styles.uploadStatusRight}>
              <span className={styles.uploadStatusMeta}>
                {uploadStatus.stage} · {uploadStatus.pct}%
              </span>
              {uploadStatus.stage === 'Uploading' && (
                <button
                  type="button"
                  className={styles.uploadCancelBtn}
                  onClick={onCancelUpload}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
          <div className={styles.uploadProgressTrack}>
            <div className={styles.uploadProgressFill} style={{ width: `${uploadStatus.pct}%` }} />
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
          onSendFiles(e.currentTarget.files);
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
          onSendFiles(e.currentTarget.files);
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
          onSendFiles(e.currentTarget.files);
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
          onSendFiles(e.currentTarget.files);
          e.currentTarget.value = '';
        }}
      />

      {filter === 'all' ? (
        <div className={styles.composerBar}>
          <div className={styles.attachMenuWrap} ref={attachMenuWrapRef}>
            {attachMenuOpen && (
              <div className={styles.attachPopover} role="menu" aria-label="Attach to My Lyga">
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
                  onClick={onPasteFromClipboard}
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
                onSendFiles(dt.files);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSendText();
              }
            }}
          />

          <button
            type="button"
            className={styles.sendBtn}
            aria-label="Send message"
            disabled={sending || !draft.trim()}
            onClick={onSendText}
          >
            <span>Send ↵</span>
          </button>
        </div>
      ) : filter === 'file' || filter === 'media' ? (
        <div className={styles.uploadDockBar}>
          <span className={styles.uploadDockText}>
            Drop {filter === 'media' ? 'photos or 4K videos' : 'files'} anywhere here to encrypt
            &amp; upload
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
  );
}

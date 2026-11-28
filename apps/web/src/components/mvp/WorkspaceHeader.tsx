'use client';

import type { ReactNode } from 'react';
import { Button } from '@mantine/core';
import { Lock, Smartphone } from 'lucide-react';
import type { FeedItemKind } from '@/lib/mvp/constants';
import type { TabFilter } from '@/lib/mvp/feed-selectors';
import styles from '@/app/app/Workspace.module.css';

interface WorkspaceHeaderProps {
  deviceCount: number;
  maxDevices: number;
  totalItems: number;
  counts: Record<FeedItemKind, number>;
  filter: TabFilter;
  onSelectFilter: (filter: TabFilter) => void;
  onOpenDevicesModal: () => void;
  mobileAccountMenu: ReactNode;
}

export function WorkspaceHeader({
  deviceCount,
  maxDevices,
  totalItems,
  counts,
  filter,
  onSelectFilter,
  onOpenDevicesModal,
  mobileAccountMenu,
}: WorkspaceHeaderProps) {
  return (
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
          <h1 className={styles.chatTitle} style={{ margin: 0 }}>
            My Lyga
          </h1>
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
              {deviceCount} of {maxDevices} devices
            </span>
          </div>
        </div>
      </div>

      <div className={styles.headerRight}>
        <div className={styles.filterStrip} role="tablist" aria-label="Filter messages">
          {(
            [
              ['all', 'All', totalItems],
              ['text', 'Notes', counts.text + counts.code],
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
              onClick={() => onSelectFilter(key)}
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
            onClick={onOpenDevicesModal}
          >
            Devices
          </Button>
          <div className={styles.mobileAccountWrap}>{mobileAccountMenu}</div>
        </div>
      </div>
    </header>
  );
}

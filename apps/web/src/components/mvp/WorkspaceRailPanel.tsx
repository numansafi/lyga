'use client';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import dynamic from 'next/dynamic';
import { Modal } from '@mantine/core';
import {
  Archive,
  Check,
  Copy,
  Download,
  Eraser,
  KeyRound,
  LogOut,
  MessageSquare,
  Pencil,
  ShieldCheck,
  Sparkles,
  UserX,
} from 'lucide-react';
import { PLANS } from '@/lib/pricingplan';
import { type WorkspaceRecord } from '@/lib/mvp/constants';
import { saveDeviceName } from '@/lib/mvp/device-label';
import {
  formatBytes,
  getLinkPreviewInfo,
  type DecryptedFeedItem,
  type DeviceOption,
  type TabFilter,
} from '@/lib/mvp/feed-selectors';
import styles from '@/app/app/Workspace.module.css';

const LygaQrCode = dynamic(
  () => import('@/components/LygaQrCode').then((m) => m.LygaQrCode),
  { ssr: false }
);

interface BeforeInstallPromptLike {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export interface WorkspaceAccountMenuProps {
  menuRef: RefObject<HTMLDivElement | null>;
  showLabel?: boolean;
  accountMenuOpen: boolean;
  setAccountMenuOpen: Dispatch<SetStateAction<boolean>>;
  userEmail: string | null;
  workspacePlan?: WorkspaceRecord['plan'];
  deferredInstallPrompt: BeforeInstallPromptLike | null;
  onInstallPwa: () => void;
  pairUrl: string;
  recoveryCopied: boolean;
  onCopyRecoveryLink: () => void;
  hasWrappedKey?: boolean;
  missingKey?: boolean;
  onOpenSyncPin: () => void;
  itemsCount: number;
  exportingZip: boolean;
  onExportZip: () => void;
  onOpenFeedback: () => void;
  onManageBilling: () => void;
  onStartCheckout: (interval: 'monthly' | 'yearly') => void;
  onSignOut: () => void;
  onOpenClearFeed: () => void;
  onOpenDeleteAccount: () => void;
}

export function WorkspaceAccountMenu({
  menuRef,
  showLabel = false,
  accountMenuOpen,
  setAccountMenuOpen,
  userEmail,
  workspacePlan,
  deferredInstallPrompt,
  onInstallPwa,
  pairUrl,
  recoveryCopied,
  onCopyRecoveryLink,
  hasWrappedKey,
  missingKey,
  onOpenSyncPin,
  itemsCount,
  exportingZip,
  onExportZip,
  onOpenFeedback,
  onManageBilling,
  onStartCheckout,
  onSignOut,
  onOpenClearFeed,
  onOpenDeleteAccount,
}: WorkspaceAccountMenuProps) {
  const accountInitial = (userEmail?.trim()?.[0] || 'L').toUpperCase();

  return (
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
            <span className={styles.accountTriggerPlan}>
              {workspacePlan === 'pro' ? 'Pro plan' : 'Free plan'}
            </span>
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
                <span className={styles.accountPopEmail}>{userEmail ?? 'Signed in'}</span>
                <span className={styles.accountPlanPill}>
                  {workspacePlan === 'pro' ? 'Pro plan' : 'Free plan'}
                </span>
              </div>
              <div className={styles.railHairline} />
            </>
          )}
          {deferredInstallPrompt && (
            <button
              type="button"
              role="menuitem"
              className={styles.accountPopBtn}
              onClick={onInstallPwa}
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
            onClick={onCopyRecoveryLink}
          >
            {recoveryCopied ? <Check size={13} /> : <ShieldCheck size={13} />}
            <span>{recoveryCopied ? 'Recovery link copied' : 'Copy backup recovery link'}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.accountPopBtn}
            disabled={Boolean(missingKey)}
            onClick={() => {
              setAccountMenuOpen(false);
              onOpenSyncPin();
            }}
          >
            <KeyRound size={13} aria-hidden="true" />
            <span>{hasWrappedKey ? 'Change Sync PIN' : 'Set 6-digit Sync PIN'}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.accountPopBtn}
            disabled={itemsCount === 0 || exportingZip}
            onClick={onExportZip}
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
              onOpenFeedback();
            }}
          >
            <MessageSquare size={13} aria-hidden="true" />
            <span>Send feedback</span>
          </button>
          <div className={styles.railHairline} />
          {workspacePlan === 'pro' ? (
            <button
              type="button"
              role="menuitem"
              className={styles.accountPopBtn}
              onClick={() => {
                setAccountMenuOpen(false);
                onManageBilling();
              }}
            >
              <Sparkles size={13} aria-hidden="true" style={{ color: '#5eead4' }} />
              <span style={{ color: '#5eead4' }}>Pro · Manage billing →</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                className={styles.accountPopBtn}
                onClick={() => {
                  setAccountMenuOpen(false);
                  onStartCheckout('yearly');
                }}
              >
                <Sparkles size={13} aria-hidden="true" style={{ color: '#5eead4' }} />
                <span style={{ color: '#5eead4' }}>Upgrade Pro · £3.75/mo (Yearly) →</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.accountPopBtn}
                onClick={() => {
                  setAccountMenuOpen(false);
                  onStartCheckout('monthly');
                }}
              >
                <Sparkles size={13} aria-hidden="true" />
                <span>Upgrade Monthly · £5/mo →</span>
              </button>
            </>
          )}
          <button
            type="button"
            role="menuitem"
            className={styles.accountPopBtn}
            onClick={() => {
              setAccountMenuOpen(false);
              onSignOut();
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
            disabled={itemsCount === 0}
            onClick={() => {
              setAccountMenuOpen(false);
              onOpenClearFeed();
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
              onOpenDeleteAccount();
            }}
          >
            <UserX size={13} aria-hidden="true" />
            <span>Delete account</span>
          </button>
        </div>
      )}
    </div>
  );
}

interface WorkspaceRailPanelProps {
  desktopMenuProps: WorkspaceAccountMenuProps;
  pinnedItems: DecryptedFeedItem[];
  copiedId: string | null;
  onCopyPinned: (id: string, text: string) => void;
  onPreview: (item: DecryptedFeedItem) => void;
  usedBytes: number;
  workspaceLimits: {
    plan: 'free' | 'pro';
    maxStorageBytes: number;
    expiryDays: number | null;
  };
  vaultBreakdown: {
    mediaBytes: number;
    mediaCount: number;
    mediaPct: number;
    fileBytes: number;
    fileCount: number;
    filePct: number;
    noteBytes: number;
    noteCount: number;
    notePct: number;
  };
  onSelectFilter: (filter: TabFilter) => void;
  devices: Array<{ id: string; label: string }>;
  deviceId: string | null;
  deviceOptionMap: Map<string, DeviceOption>;
  myDeviceName: string;
  setMyDeviceName: (name: string) => void;
  setDevices: Dispatch<SetStateAction<Array<{ id: string; label: string }>>>;
  editingName: boolean;
  setEditingName: (v: boolean) => void;
  nameDraft: string;
  setNameDraft: (v: string) => void;
  confirmDisconnectId: string | null;
  setConfirmDisconnectId: Dispatch<SetStateAction<string | null>>;
  onRemoveDevice: (id: string) => void;
  showQr: boolean;
  setShowQr: Dispatch<SetStateAction<boolean>>;
  pairUrl: string;
  pairCopied: boolean;
  onCopyPairUrl: () => void;
  qrModalOpen: boolean;
  onCloseQrModal: () => void;
}

export function WorkspaceRailPanel({
  desktopMenuProps,
  pinnedItems,
  copiedId,
  onCopyPinned,
  onPreview,
  usedBytes,
  workspaceLimits,
  vaultBreakdown,
  onSelectFilter,
  devices,
  deviceId,
  deviceOptionMap,
  myDeviceName,
  setMyDeviceName,
  setDevices,
  editingName,
  setEditingName,
  nameDraft,
  setNameDraft,
  confirmDisconnectId,
  setConfirmDisconnectId,
  onRemoveDevice,
  showQr,
  setShowQr,
  pairUrl,
  pairCopied,
  onCopyPairUrl,
  qrModalOpen,
  onCloseQrModal,
}: WorkspaceRailPanelProps) {
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
        <p className={styles.qrDesc}>Scan with your phone camera to sync.</p>
        <button
          type="button"
          className={styles.qrCopyLinkBtn}
          aria-label={pairCopied ? 'Pair link copied' : 'Copy pair link'}
          disabled={!pairUrl}
          onClick={onCopyPairUrl}
        >
          {pairCopied ? <Check size={11} /> : <Copy size={11} />}
          <span>{pairCopied ? 'Copied' : 'Copy pair link'}</span>
        </button>
      </div>
    </div>
  );

  const renderPinnedSection = () => (
    <div className={`${styles.railSection} ${styles.pinnedSection}`}>
      <div className={styles.sectionHeaderRow}>
        <span className={styles.sectionTitle}>Pinned</span>
        <span className={styles.sectionMuted}>
          {pinnedItems.length} {pinnedItems.length === 1 ? 'item' : 'items'}
        </span>
      </div>
      {pinnedItems.length === 0 ? (
        <p className={styles.pinnedEmpty}>Pin any message, link, or file to keep it here.</p>
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
                      onPreview(item);
                    }
                  } else if (item.raw.kind === 'file' || item.raw.kind === 'media') {
                    onPreview(item);
                  } else if (item.bodyText) {
                    onCopyPinned(item.raw.id, item.bodyText);
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

  const renderStorageCard = () => (
    <div className={styles.railSection}>
      <div className={styles.storageRow}>
        <span>Storage</span>
        <span>
          {formatBytes(usedBytes)} / {formatBytes(workspaceLimits.maxStorageBytes)}
        </span>
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
        <button type="button" className={styles.vaultItemBtn} onClick={() => onSelectFilter('media')}>
          <span className={styles.vaultItemLeft}>
            <span className={styles.vaultSwatch} style={{ backgroundColor: '#2dd4bf' }} />
            <span>Photos &amp; Videos</span>
          </span>
          <span className={styles.vaultItemValue}>
            {formatBytes(vaultBreakdown.mediaBytes)} ({vaultBreakdown.mediaCount})
          </span>
        </button>
        <button type="button" className={styles.vaultItemBtn} onClick={() => onSelectFilter('file')}>
          <span className={styles.vaultItemLeft}>
            <span className={styles.vaultSwatch} style={{ backgroundColor: '#60a5fa' }} />
            <span>Files &amp; PDFs</span>
          </span>
          <span className={styles.vaultItemValue}>
            {formatBytes(vaultBreakdown.fileBytes)} ({vaultBreakdown.fileCount})
          </span>
        </button>
        <button type="button" className={styles.vaultItemBtn} onClick={() => onSelectFilter('text')}>
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
        <span>
          {workspaceLimits.expiryDays === null
            ? 'Files: Never expire'
            : `Auto-delete: After ${workspaceLimits.expiryDays} days`}
        </span>
        <span>
          Max {workspaceLimits.plan === 'pro' ? PLANS.pro.maxFileLabel : PLANS.free.maxFileLabel} / file
        </span>
      </div>
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
            setDevices((prev) => prev.map((d) => (d.id === deviceId ? { ...d, label: saved } : d)));
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
              if (e.key === 'Escape') setEditingName(false);
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
                ) : confirmDisconnectId === dev.id ? (
                  <button
                    type="button"
                    className={`${styles.removeDevBtn} ${styles.removeDevConfirm}`}
                    aria-label={`Confirm disconnect ${label}`}
                    onClick={() => {
                      setConfirmDisconnectId(null);
                      onRemoveDevice(dev.id);
                    }}
                  >
                    Confirm?
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.removeDevBtn}
                    aria-label={`Disconnect ${label}`}
                    onClick={() => {
                      setConfirmDisconnectId(dev.id);
                      window.setTimeout(
                        () => setConfirmDisconnectId((curr) => (curr === dev.id ? null : curr)),
                        4000
                      );
                    }}
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

  return (
    <>
      <aside className={styles.rail} aria-label="Workspace devices and pairing">
        <div className={styles.railHeaderBar}>
          <WorkspaceAccountMenu {...desktopMenuProps} showLabel />
        </div>
        {renderPinnedSection()}
        <div className={styles.railHairline} />
        {renderStorageCard()}
        <div className={styles.railHairline} />
        {renderDeviceCard()}
      </aside>

      <Modal
        opened={qrModalOpen}
        onClose={onCloseQrModal}
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
    </>
  );
}

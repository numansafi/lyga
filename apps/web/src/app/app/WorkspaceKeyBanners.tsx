'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Modal } from '@mantine/core';
import { Check, Eye, EyeOff, KeyRound, Lock, ShieldCheck, Smartphone } from 'lucide-react';
import type { WorkspaceRecord } from '@/lib/mvp/constants';
import {
  combinePinWithPepper,
  decryptWmkFromApproval,
  derivePinHash,
  deriveShortVerificationCode,
  encryptWmkForPublicKey,
  generateApprovalKeyPair,
  unwrapWorkspaceKey,
  validateSyncPin,
  wrapWorkspaceKey,
  type WrappedWorkspaceKey,
} from '@/lib/mvp/crypto';
import { getWorkspaceKey, saveWorkspaceKey } from '@/lib/mvp/key-store';
import styles from './Workspace.module.css';

interface PendingApprovalItem {
  id: string;
  requesterLabel: string;
  publicKeyB64: string;
  verificationCode: string;
  expiresAt: number;
}

interface UnlockBannerProps {
  workspace: WorkspaceRecord;
  myDeviceName: string;
  recoveryDraft: string;
  setRecoveryDraft: (v: string) => void;
  unlockingKey: boolean;
  onUnlockWithLink: (e: FormEvent) => Promise<void>;
  onUnlocked: () => Promise<void>;
  setErrorMsg: (msg: string | null) => void;
  setInfoMsg: (msg: string | null) => void;
}

export function WorkspaceKeyUnlockBanner({
  workspace,
  myDeviceName,
  recoveryDraft,
  setRecoveryDraft,
  unlockingKey,
  onUnlockWithLink,
  onUnlocked,
  setErrorMsg,
  setInfoMsg,
}: UnlockBannerProps) {
  const [secret, setSecret] = useState('');
  const [unlockingSecret, setUnlockingSecret] = useState(false);
  const [showLinkFallback, setShowLinkFallback] = useState(!workspace.hasWrappedKey);
  const [approvalState, setApprovalState] = useState<{
    id: string;
    code: string;
  } | null>(null);
  const [requestingApproval, setRequestingApproval] = useState(false);
  const approvalPrivateKeyRef = useRef<CryptoKey | null>(null);

  useEffect(() => {
    if (!approvalState) return;
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/mvp/device-approve?id=${encodeURIComponent(approvalState.id)}`,
          { cache: 'no-store' }
        );
        if (!res.ok || !active) return;
        const data = (await res.json()) as {
          status?: 'pending' | 'approved' | 'expired';
          encryptedPayload?: string;
        };
        if (data.status === 'expired') {
          setApprovalState(null);
          approvalPrivateKeyRef.current = null;
          setErrorMsg('Approval request expired. Try again.');
          return;
        }
        if (data.status === 'approved' && data.encryptedPayload && approvalPrivateKeyRef.current) {
          const wmk = await decryptWmkFromApproval(
            data.encryptedPayload,
            approvalPrivateKeyRef.current,
            approvalState.id
          );
          await saveWorkspaceKey(workspace.id, wmk);
          approvalPrivateKeyRef.current = null;
          setApprovalState(null);
          setInfoMsg('Workspace unlocked from your paired device.');
          await onUnlocked();
        }
      } catch {
        // Keep polling until expiry or success.
      }
    };
    const timer = window.setInterval(() => void poll(), 2000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [approvalState, onUnlocked, setErrorMsg, setInfoMsg, workspace.id]);

  const handleSecretUnlock = async (e: FormEvent) => {
    e.preventDefault();
    if (!secret.trim()) return;
    const isPin = workspace.wmkWrapKind !== 'password';
    if (isPin && !/^\d{6}$/.test(secret)) {
      setErrorMsg('Sync PIN must be 6 digits.');
      return;
    }
    setUnlockingSecret(true);
    setErrorMsg(null);
    try {
      const keyRes = await fetch('/api/mvp/workspace/key', { cache: 'no-store' });
      if (!keyRes.ok) {
        throw new Error('Unable to load wrapped key.');
      }
      const data = (await keyRes.json()) as { wrappedKey?: WrappedWorkspaceKey | null };
      if (!data.wrappedKey) {
        throw new Error('No wrapped key found on this account.');
      }

      let unwrapSecret = secret;
      if (data.wrappedKey.kind === 'passphrase') {
        const pinHash = await derivePinHash(secret, workspace.id);
        const pepperRes = await fetch('/api/mvp/workspace/pin-pepper', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pinHash, mode: 'unlock' }),
        });
        if (!pepperRes.ok) {
          const err = (await pepperRes.json().catch(() => null)) as { error?: string } | null;
          setErrorMsg(err?.error ?? 'Unable to verify Sync PIN.');
          return;
        }
        const pepperData = (await pepperRes.json()) as { pepper: string };
        unwrapSecret = combinePinWithPepper(secret, pepperData.pepper);
      }

      const wmk = await unwrapWorkspaceKey(data.wrappedKey, unwrapSecret, workspace.id);
      await saveWorkspaceKey(workspace.id, wmk);
      setSecret('');
      setInfoMsg('Workspace unlocked.');
      await onUnlocked();
    } catch {
      setErrorMsg(
        workspace.wmkWrapKind === 'password'
          ? 'Incorrect Lyga password. Try again, or use a paired device.'
          : 'Incorrect Sync PIN. Try again, or use a paired device.'
      );
    } finally {
      setUnlockingSecret(false);
    }
  };

  const handleRequestDeviceApproval = async () => {
    setRequestingApproval(true);
    setErrorMsg(null);
    try {
      const { publicKeyB64, privateKey } = await generateApprovalKeyPair();
      const verificationCode = await deriveShortVerificationCode(publicKeyB64, workspace.id);
      const res = await fetch('/api/mvp/device-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKeyB64,
          verificationCode,
          label: myDeviceName || 'New Browser',
        }),
      });
      if (!res.ok) {
        throw new Error('Unable to request device approval.');
      }
      const data = (await res.json()) as { id: string };
      approvalPrivateKeyRef.current = privateKey;
      setApprovalState({ id: data.id, code: verificationCode });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to request device approval.');
    } finally {
      setRequestingApproval(false);
    }
  };

  const isPasswordWrapped = workspace.wmkWrapKind === 'password';
  const secretLabel = isPasswordWrapped
    ? 'Enter your Lyga password'
    : 'Enter your 6-digit Sync PIN';

  return (
    <div className={styles.recoveryBanner}>
      <div className={styles.recoveryBannerText}>
        <Lock size={14} aria-hidden="true" />
        <span>
          This browser doesn&apos;t have your encryption key yet. Unlock with your{' '}
          {workspace.hasWrappedKey
            ? isPasswordWrapped
              ? 'password, approve from a paired device,'
              : '6-digit Sync PIN, approve from a paired device,'
            : 'paired device'}{' '}
          or use a backup recovery link.
        </span>
      </div>

      {workspace.hasWrappedKey ? (
        <form className={styles.recoveryBannerRow} onSubmit={(e) => void handleSecretUnlock(e)}>
          <input
            type="password"
            inputMode={isPasswordWrapped ? undefined : 'numeric'}
            maxLength={isPasswordWrapped ? undefined : 6}
            className={styles.recoveryInput}
            placeholder={secretLabel}
            value={secret}
            onChange={(e) => {
              const val = e.currentTarget.value;
              setSecret(isPasswordWrapped ? val : val.replace(/\D/g, '').slice(0, 6));
            }}
            autoComplete={isPasswordWrapped ? 'current-password' : 'one-time-code'}
          />
          <button
            type="submit"
            className={styles.recoveryUnlockBtn}
            disabled={unlockingSecret || secret.length < 6}
          >
            {unlockingSecret ? 'Unlocking…' : 'Unlock'}
          </button>
        </form>
      ) : null}

      <div className={styles.recoveryBannerRow} style={{ flexWrap: 'wrap', alignItems: 'center' }}>
        {approvalState ? (
          <div className={styles.recoveryBannerText} style={{ alignItems: 'center' }}>
            <Smartphone size={14} aria-hidden="true" />
            <span>
              Waiting for approval on your other device — match code:{' '}
              <strong style={{ color: '#5eead4', letterSpacing: '0.12em' }}>
                {approvalState.code}
              </strong>
            </span>
            <button
              type="button"
              className={styles.recoveryUnlockBtn}
              onClick={() => {
                approvalPrivateKeyRef.current = null;
                setApprovalState(null);
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={styles.recoveryUnlockBtn}
            disabled={requestingApproval}
            onClick={() => void handleRequestDeviceApproval()}
          >
            {requestingApproval ? 'Requesting…' : '1-Tap Approve from Paired Device'}
          </button>
        )}

        <button
          type="button"
          className={styles.recoveryUnlockBtn}
          style={{
            background: 'transparent',
            color: '#ccfbf1',
            border: '1px solid rgba(94, 234, 212, 0.28)',
          }}
          onClick={() => setShowLinkFallback((v) => !v)}
        >
          {showLinkFallback ? 'Hide recovery link' : 'Use backup link'}
        </button>
      </div>

      {showLinkFallback ? (
        <form className={styles.recoveryBannerRow} onSubmit={(e) => void onUnlockWithLink(e)}>
          <input
            type="password"
            className={styles.recoveryInput}
            placeholder="Paste backup recovery link (#wmk=...)"
            value={recoveryDraft}
            onChange={(e) => setRecoveryDraft(e.currentTarget.value)}
          />
          <button
            type="submit"
            className={styles.recoveryUnlockBtn}
            disabled={unlockingKey || !recoveryDraft.trim()}
          >
            {unlockingKey ? 'Unlocking…' : 'Unlock'}
          </button>
        </form>
      ) : null}
    </div>
  );
}

interface SetupAndApproveProps {
  workspace: WorkspaceRecord;
  onWrappedSaved: () => Promise<void>;
  setErrorMsg: (msg: string | null) => void;
  setInfoMsg: (msg: string | null) => void;
}

async function saveSixDigitSyncPin(workspaceId: string, pin: string): Promise<void> {
  const validationError = validateSyncPin(pin);
  if (validationError) {
    throw new Error(validationError);
  }
  const wmk = await getWorkspaceKey(workspaceId);
  if (!wmk) {
    throw new Error('Local workspace key is unavailable.');
  }
  const pinHash = await derivePinHash(pin, workspaceId);
  const pepperRes = await fetch('/api/mvp/workspace/pin-pepper', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pinHash, mode: 'setup' }),
  });
  if (!pepperRes.ok) {
    const err = (await pepperRes.json().catch(() => null)) as { error?: string } | null;
    throw new Error(err?.error ?? 'Unable to set Sync PIN.');
  }
  const pepperData = (await pepperRes.json()) as { pepper: string };
  const wrapped = await wrapWorkspaceKey(
    wmk,
    combinePinWithPepper(pin, pepperData.pepper),
    workspaceId,
    'passphrase'
  );
  const res = await fetch('/api/mvp/workspace/key', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(wrapped),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(err?.error ?? 'Unable to save Sync PIN.');
  }
}

export function WorkspaceKeySetupAndApproveBanners({
  workspace,
  onWrappedSaved,
  setErrorMsg,
  setInfoMsg,
}: SetupAndApproveProps) {
  const [passphrase, setPassphrase] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [savingPassphrase, setSavingPassphrase] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalItem[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const fetchPendingApprovals = useCallback(async () => {
    try {
      const res = await fetch('/api/mvp/device-approve', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { pending?: PendingApprovalItem[] };
      setPendingApprovals(data.pending ?? []);
    } catch {
      // Ignore transient polling failures.
    }
  }, []);

  useEffect(() => {
    void fetchPendingApprovals();
    const timer = window.setInterval(() => void fetchPendingApprovals(), 5000);
    return () => window.clearInterval(timer);
  }, [fetchPendingApprovals]);

  const handleSavePassphrase = async (e: FormEvent) => {
    e.preventDefault();
    setSavingPassphrase(true);
    setErrorMsg(null);
    try {
      await saveSixDigitSyncPin(workspace.id, passphrase);
      setPassphrase('');
      setShowPin(false);
      setInfoMsg('6-digit Sync PIN saved. New browsers can now unlock with it.');
      await onWrappedSaved();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save Sync PIN.');
    } finally {
      setSavingPassphrase(false);
    }
  };

  const handleApproveDevice = async (req: PendingApprovalItem) => {
    setApprovingId(req.id);
    setErrorMsg(null);
    try {
      const expectedCode = await deriveShortVerificationCode(req.publicKeyB64, workspace.id);
      if (expectedCode !== req.verificationCode) {
        throw new Error('Verification code mismatch.');
      }
      const wmk = await getWorkspaceKey(workspace.id);
      if (!wmk) {
        throw new Error('Local workspace key is unavailable.');
      }
      const encryptedPayload = await encryptWmkForPublicKey(wmk, req.publicKeyB64, req.id);
      const res = await fetch('/api/mvp/device-approve', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: req.id, encryptedPayload }),
      });
      if (!res.ok) {
        throw new Error('Approval request expired.');
      }
      setPendingApprovals((curr) => curr.filter((item) => item.id !== req.id));
      setInfoMsg(`Approved "${req.requesterLabel}".`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to approve device.');
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <>
      {pendingApprovals.map((req) => (
        <div key={req.id} className={styles.recoveryBanner}>
          <div className={styles.recoveryBannerRow} style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <div className={styles.recoveryBannerText}>
              <ShieldCheck size={14} aria-hidden="true" />
              <span>
                <strong>{req.requesterLabel}</strong> wants to unlock your encrypted workspace.
                Verify match code:{' '}
                <strong style={{ color: '#5eead4', letterSpacing: '0.12em' }}>
                  {req.verificationCode}
                </strong>
              </span>
            </div>
            <button
              type="button"
              className={styles.recoveryUnlockBtn}
              disabled={approvingId === req.id}
              onClick={() => void handleApproveDevice(req)}
            >
              <Check size={14} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />
              {approvingId === req.id ? 'Approving…' : 'Approve'}
            </button>
          </div>
        </div>
      ))}

      {!workspace.hasWrappedKey ? (
        <form className={styles.recoveryBanner} onSubmit={(e) => void handleSavePassphrase(e)}>
          <div className={styles.recoveryBannerText}>
            <KeyRound size={14} aria-hidden="true" />
            <span>
              <strong>Required:</strong> Set a 6-digit Sync PIN so you can unlock your encrypted
              workspace on any new browser without needing a paired device nearby.
            </span>
          </div>
          <div className={styles.recoveryBannerRow}>
            <input
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={6}
              pattern="\d{6}"
              className={styles.recoveryInput}
              placeholder="Create a 6-digit Sync PIN"
              value={passphrase}
              onChange={(e) => setPassphrase(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
              autoComplete="one-time-code"
            />
            <button
              type="button"
              className={styles.recoveryUnlockBtn}
              aria-label={showPin ? 'Hide Sync PIN' : 'Show Sync PIN'}
              style={{
                background: 'transparent',
                color: '#ccfbf1',
                border: '1px solid rgba(94, 234, 212, 0.28)',
                padding: '0 10px',
              }}
              onClick={() => setShowPin((v) => !v)}
            >
              {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <button
              type="submit"
              className={styles.recoveryUnlockBtn}
              disabled={savingPassphrase || passphrase.length !== 6}
            >
              {savingPassphrase ? 'Saving…' : 'Save Sync PIN'}
            </button>
          </div>
        </form>
      ) : null}
    </>
  );
}

interface SyncPinModalProps {
  opened: boolean;
  workspace: WorkspaceRecord | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  setInfoMsg: (msg: string | null) => void;
}

export function SyncPinModal({
  opened,
  workspace,
  onClose,
  onSaved,
  setInfoMsg,
}: SyncPinModalProps) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    setSaving(true);
    setLocalError(null);
    try {
      await saveSixDigitSyncPin(workspace.id, pin);
      setPin('');
      setShowPin(false);
      setInfoMsg('6-digit Sync PIN updated.');
      await onSaved();
      onClose();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unable to save Sync PIN.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        setPin('');
        setLocalError(null);
        onClose();
      }}
      title={workspace?.hasWrappedKey ? 'Change 6-digit Sync PIN' : 'Set 6-digit Sync PIN'}
      centered
      size="sm"
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, opacity: 0.85 }}>
          Your 6-digit Sync PIN wraps your encryption key locally so new browsers can unlock it.
        </p>
        <div className={styles.recoveryBannerRow}>
          <input
            type={showPin ? 'text' : 'password'}
            inputMode="numeric"
            maxLength={6}
            pattern="\d{6}"
            className={styles.recoveryInput}
            placeholder="Enter new 6-digit Sync PIN"
            value={pin}
            onChange={(e) => setPin(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
            autoComplete="one-time-code"
            autoFocus
          />
          <button
            type="button"
            className={styles.recoveryUnlockBtn}
            aria-label={showPin ? 'Hide Sync PIN' : 'Show Sync PIN'}
            style={{
              background: 'transparent',
              color: '#ccfbf1',
              border: '1px solid rgba(94, 234, 212, 0.28)',
              padding: '0 10px',
            }}
            onClick={() => setShowPin((v) => !v)}
          >
            {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {localError ? (
          <p style={{ margin: 0, fontSize: 12.5, color: '#fda4af' }}>{localError}</p>
        ) : null}
        <button
          type="submit"
          className={styles.recoveryUnlockBtn}
          style={{ height: 38 }}
          disabled={saving || pin.length !== 6}
        >
          {saving ? 'Saving…' : 'Save 6-digit Sync PIN'}
        </button>
      </form>
    </Modal>
  );
}

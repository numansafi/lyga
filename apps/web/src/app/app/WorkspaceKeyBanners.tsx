'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Lock, ShieldCheck, Smartphone } from 'lucide-react';
import type { WorkspaceRecord } from '@/lib/mvp/constants';
import {
  decryptWmkFromApproval,
  deriveShortVerificationCode,
  encryptWmkForPublicKey,
  generateApprovalKeyPair,
  unwrapWorkspaceKey,
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

      const wmk = await unwrapWorkspaceKey(data.wrappedKey, secret, workspace.id);
      await saveWorkspaceKey(workspace.id, wmk);
      setSecret('');
      setInfoMsg('Workspace unlocked.');
      await onUnlocked();
    } catch {
      setErrorMsg('Incorrect Lyga password. Try again, or use a paired device.');
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

  return (
    <div className={styles.recoveryBanner}>
      <div className={styles.recoveryBannerText}>
        <Lock size={14} aria-hidden="true" />
        <span>
          This device doesn&apos;t have your encryption key yet. Unlock with your{' '}
          {workspace.hasWrappedKey
            ? 'password, approve from a paired device,'
            : 'paired device'}{' '}
          or use a backup recovery link.
        </span>
      </div>

      {workspace.hasWrappedKey ? (
        <form
          className={styles.recoveryBannerRow}
          style={{ flexWrap: 'wrap', alignItems: 'center' }}
          onSubmit={(e) => void handleSecretUnlock(e)}
        >
          <input
            type="password"
            className={styles.recoveryInput}
            placeholder="Enter your Lyga password"
            value={secret}
            onChange={(e) => setSecret(e.currentTarget.value)}
            autoComplete="current-password"
          />
          <button
            type="submit"
            className={styles.recoveryUnlockBtn}
            style={{ height: 38 }}
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

export function WorkspaceKeySetupAndApproveBanners({
  workspace,
  setErrorMsg,
  setInfoMsg,
}: SetupAndApproveProps) {
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

  const handleApproveDevice = async (req: PendingApprovalItem) => {
    setApprovingId(req.id);
    setErrorMsg(null);
    try {
      const wmk = await getWorkspaceKey(workspace.id);
      if (!wmk) {
        throw new Error('This device does not have the workspace key.');
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

  if (pendingApprovals.length === 0) return null;

  return (
    <>
      {pendingApprovals.map((req) => (
        <div key={req.id} className={styles.recoveryBanner}>
          <div
            className={styles.recoveryBannerRow}
            style={{ alignItems: 'center', justifyContent: 'space-between' }}
          >
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
    </>
  );
}

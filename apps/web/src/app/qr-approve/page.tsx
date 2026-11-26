'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Loader } from '@mantine/core';
import { Check, Laptop, Lock } from 'lucide-react';
import { getWorkspaceKey } from '@/lib/mvp/key-store';
import { encryptWmkForQr } from '@/lib/mvp/qr-crypto';
import styles from '../pair/Pair.module.css';

interface WorkspaceResponse {
  workspace: {
    id: string;
  };
}

export default function QrApprovePage() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'approving' | 'approved' | 'error'>(
    'loading'
  );
  const [errorMsg, setErrorMsg] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [publicKeyB64, setPublicKeyB64] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id')?.trim() ?? '';
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const pk = hashParams.get('k')?.trim() ?? '';

      if (!id || !pk) {
        if (!active) return;
        setStatus('error');
        setErrorMsg('Invalid QR code link.');
        return;
      }

      setChallengeId(id);
      setPublicKeyB64(pk);

      const res = await fetch('/api/mvp/workspace', { cache: 'no-store' });
      if (!res.ok) {
        if (!active) return;
        setStatus('error');
        setErrorMsg('Sign in to Lyga on this phone first, then scan the QR code again.');
        return;
      }

      const data = (await res.json()) as WorkspaceResponse;
      if (!active) return;
      setWorkspaceId(data.workspace.id);
      setStatus('ready');
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const handleApprove = async () => {
    setStatus('approving');
    try {
      const wmk = await getWorkspaceKey(workspaceId);
      if (!wmk) {
        setStatus('error');
        setErrorMsg('Encryption key not found on this device. Open Lyga on this phone first.');
        return;
      }

      const encryptedWmk = await encryptWmkForQr(wmk, publicKeyB64);
      const res = await fetch('/api/mvp/qr-login/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: challengeId,
          encryptedWmk,
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        setStatus('error');
        setErrorMsg(err?.error ?? 'Could not approve computer sign-in.');
        return;
      }

      setStatus('approved');
    } catch {
      setStatus('error');
      setErrorMsg('Unable to encrypt and send workspace key.');
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <span className={styles.badge}>
          <Lock size={12} aria-hidden="true" />
          End-to-End Encrypted
        </span>

        {status === 'loading' && (
          <>
            <Loader color="spruce" size="md" />
            <h1 className={styles.title}>Checking device…</h1>
          </>
        )}

        {(status === 'ready' || status === 'approving') && (
          <>
            <Laptop size={36} color="#5eead4" aria-hidden="true" />
            <h1 className={styles.title}>Unlock Lyga on your computer?</h1>
            <p className={styles.desc}>
              This shares your encryption key directly with the browser you scanned, so both
              devices stay synced.
            </p>
            <Button
              fullWidth
              color="spruce"
              loading={status === 'approving'}
              onClick={() => void handleApprove()}
            >
              Approve &amp; Sync Computer
            </Button>
          </>
        )}

        {status === 'approved' && (
          <>
            <Check size={36} color="#5eead4" aria-hidden="true" />
            <h1 className={styles.title}>Computer unlocked</h1>
            <p className={styles.desc}>
              Your other browser is signing in now. You can close this tab or return to Lyga.
            </p>
            <Button component={Link} href="/app" fullWidth color="spruce">
              Open Lyga
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className={styles.title}>Could not unlock</h1>
            <p className={styles.desc}>{errorMsg}</p>
            <Button component={Link} href="/login" fullWidth color="spruce">
              Sign in on this device
            </Button>
          </>
        )}
      </div>
    </main>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Loader } from '@mantine/core';
import { Lock } from 'lucide-react';
import { detectDeviceName } from '@/lib/mvp/device-label';
import { saveWorkspaceKey } from '@/lib/mvp/key-store';
import styles from './Pair.module.css';

export default function PairPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'pairing' | 'error'>('pairing');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let active = true;

    async function runPair() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code')?.trim() ?? '';
      const hash = window.location.hash.replace(/^#/, '');
      const hashParams = new URLSearchParams(hash);
      const wmk = hashParams.get('wmk')?.trim() ?? '';

      if (!code || !wmk) {
        if (!active) return;
        setStatus('error');
        setErrorMsg('Missing pairing code or encryption key in URL.');
        return;
      }

      const label = detectDeviceName();

      const res = await fetch('/api/mvp/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, label }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!active) return;
        setStatus('error');
        setErrorMsg(err?.error ?? 'Unable to pair this device.');
        return;
      }

      const data = (await res.json()) as { workspaceId: string };
      await saveWorkspaceKey(data.workspaceId, wmk);
      router.replace('/app');
    }

    void runPair();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <span className={styles.badge}>
          <Lock size={12} aria-hidden="true" />
          End-to-End Encrypted
        </span>

        {status === 'pairing' ? (
          <>
            <Loader color="spruce" size="md" />
            <h1 className={styles.title}>Connecting to your feed…</h1>
            <p className={styles.desc}>
              Saving your encryption key locally on this device. Nothing leaves your browser.
            </p>
          </>
        ) : (
          <>
            <h1 className={styles.title}>Could not connect</h1>
            <p className={styles.desc}>{errorMsg}</p>
            <Button component={Link} href="/app" fullWidth>
              Open a new workspace
            </Button>
          </>
        )}
      </div>
    </main>
  );
}

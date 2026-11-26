'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Loader } from '@mantine/core';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import styles from '../../login/Login.module.css';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function completeAuth() {
      const supabase = getSupabaseBrowser();
      if (!supabase) {
        router.replace('/login');
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const oauthError = params.get('error_description') || params.get('error');
      if (oauthError) {
        if (active) setErrorMsg(oauthError);
        return;
      }

      const code = params.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (active) setErrorMsg(error.message);
          return;
        }
      }

      const { data, error } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (error || !accessToken) {
        if (active) setErrorMsg(error?.message ?? 'Could not verify sign-in session.');
        return;
      }

      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        if (active) setErrorMsg(err?.error ?? 'Unable to start your Lyga session.');
        return;
      }

      router.replace('/app');
    }

    void completeAuth();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        {errorMsg ? (
          <>
            <h1 className={styles.title}>Sign-in failed</h1>
            <p className={styles.subtitle}>{errorMsg}</p>
            <Button component={Link} href="/login" fullWidth color="spruce">
              Back to login
            </Button>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Loader color="spruce" size="md" />
            <div style={{ fontSize: 14, color: '#ccfbf1' }}>Finishing sign-in…</div>
          </div>
        )}
      </div>
    </main>
  );
}

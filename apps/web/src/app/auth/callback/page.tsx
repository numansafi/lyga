'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Loader } from '@mantine/core';
import type { EmailOtpType } from '@supabase/supabase-js';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import styles from '../../login/Login.module.css';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedCrossDevice, setConfirmedCrossDevice] = useState(false);

  useEffect(() => {
    let active = true;

    async function completeAuth() {
      const supabase = getSupabaseBrowser();
      if (!supabase) {
        router.replace('/login');
        return;
      }

      try {
        const params = new URLSearchParams(window.location.search);
        const oauthError = params.get('error_description') || params.get('error');
        if (oauthError) {
          if (active) setErrorMsg(oauthError);
          return;
        }

        const tokenHash = params.get('token_hash');
        const otpType = params.get('type') as EmailOtpType | null;
        if (tokenHash && otpType) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          });
          if (error) {
            if (active) setErrorMsg(error.message);
            return;
          }
        }

        const code = params.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            if (active) {
              if (error.message.toLowerCase().includes('code verifier')) {
                setConfirmedCrossDevice(true);
              } else {
                setErrorMsg(error.message);
              }
            }
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
      } catch {
        if (active) setErrorMsg('Unable to finish sign-in. Please try again.');
      }
    }

    void completeAuth();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        {confirmedCrossDevice ? (
          <>
            <h1 className={styles.title}>Email confirmed!</h1>
            <p className={styles.subtitle}>
              Log in here or on the device where you started.
            </p>
            <Button component={Link} href="/login" fullWidth color="spruce">
              Log in →
            </Button>
          </>
        ) : errorMsg ? (
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

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Loader } from '@mantine/core';
import type { EmailOtpType } from '@supabase/supabase-js';
import { AlertCircle, Check, Lock } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import loginStyles from '../../login/Login.module.css';
import styles from './Callback.module.css';

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

        const nextParam = params.get('next');
        const safeNext =
          nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
            ? nextParam
            : '/app';
        router.replace(safeNext);
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
    <main className={loginStyles.page}>
      <div className={styles.callbackCard}>
        <div className={loginStyles.topRow}>
          <Link href="/" className={loginStyles.brand}>
            <svg width="24" height="24" viewBox="48 48 160 178" fill="none" aria-hidden="true">
              <path
                stroke="#5EEAD4"
                strokeWidth="28"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M64 94L92 66v116h100l-28 28"
              />
            </svg>
            <span>LYGA</span>
          </Link>
          <span className={loginStyles.e2eeBadge}>
            <Lock size={11} aria-hidden="true" />
            Encrypted
          </span>
        </div>

        {confirmedCrossDevice ? (
          <>
            <div className={styles.centerBlock}>
              <div className={styles.checkBadge} aria-hidden="true">
                <Check size={28} strokeWidth={2.4} />
              </div>
              <h1 className={loginStyles.title}>Email confirmed</h1>
              <p className={styles.subtitle}>
                Your account is verified and ready. Log in here, or close this tab and sign in on
                the device where you started.
              </p>
            </div>
            <Button component={Link} href="/login" fullWidth className={loginStyles.primaryBtn}>
              Log in to Lyga →
            </Button>
            <div className={styles.hintBox}>
              Opened this link on your phone? You can head back to your computer and log in there.
            </div>
          </>
        ) : errorMsg ? (
          <>
            <div className={styles.centerBlock}>
              <div className={styles.errorBadge} aria-hidden="true">
                <AlertCircle size={26} strokeWidth={2.2} />
              </div>
              <h1 className={loginStyles.title}>Sign-in failed</h1>
              <p className={styles.subtitle}>{errorMsg}</p>
            </div>
            <Button component={Link} href="/login" fullWidth className={loginStyles.primaryBtn}>
              Back to login →
            </Button>
          </>
        ) : (
          <div className={styles.loadingBlock}>
            <Loader color="spruce" size="md" />
            <div className={styles.loadingText}>Finishing sign-in…</div>
          </div>
        )}
      </div>
    </main>
  );
}

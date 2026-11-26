'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, Loader } from '@mantine/core';
import { Lock, Mail } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import styles from './Login.module.css';

type AuthMode = 'otp' | 'password';

export default function LoginPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<AuthMode>('otp');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((res) => {
        if (!active) return;
        if (res.ok) {
          router.replace('/app');
        } else {
          setChecking(false);
        }
      })
      .catch(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  const exchangeSession = async (accessToken: string) => {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(err?.error ?? 'Unable to complete sign-in.');
    }
    router.replace('/app');
  };

  const handleGoogleLogin = async () => {
    if (!supabase) return;
    setErrorMsg(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setErrorMsg(error.message);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to start Google sign-in.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    const cleanEmail = email.trim();
    if (!cleanEmail) return;

    if (!supabase) {
      setLoading(true);
      try {
        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ devEmail: cleanEmail }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as { error?: string } | null;
          setErrorMsg(err?.error ?? 'Unable to sign in.');
          return;
        }
        router.replace('/app');
      } catch {
        setErrorMsg('Unable to reach sign-in service.');
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setErrorMsg(error.message);
        return;
      }
      setOtpSent(true);
      setInfoMsg('Check your email for a 6-digit code or sign-in link.');
    } catch {
      setErrorMsg('Unable to send sign-in email.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setErrorMsg(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: 'email',
      });
      if (error || !data.session?.access_token) {
        setErrorMsg(error?.message ?? 'Invalid or expired code.');
        return;
      }
      await exchangeSession(data.session.access_token);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to verify code.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) {
          setErrorMsg(error.message);
          return;
        }
        if (data.session?.access_token) {
          await exchangeSession(data.session.access_token);
        } else {
          setInfoMsg('Account created! Check your email to confirm and sign in.');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error || !data.session?.access_token) {
          setErrorMsg(error?.message ?? 'Invalid email or password.');
          return;
        }
        await exchangeSession(data.session.access_token);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <main className={styles.page}>
        <Loader color="spruce" size="md" />
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <Link href="/" className={styles.brand}>
          <svg width="24" height="24" viewBox="48 48 160 178" fill="none" aria-hidden="true">
            <path
              stroke="#2DD4BF"
              strokeWidth="28"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M64 94L92 66v116h100l-28 28"
            />
          </svg>
          <span>LYGA</span>
        </Link>

        <h1 className={styles.title}>Sign in to your feed</h1>
        <p className={styles.subtitle}>
          <Lock size={12} aria-hidden="true" />
          End-to-end encrypted across your phone and computer
        </p>

        {errorMsg && (
          <Alert color="red" withCloseButton onClose={() => setErrorMsg(null)}>
            {errorMsg}
          </Alert>
        )}
        {infoMsg && <Alert color="spruce">{infoMsg}</Alert>}

        {supabase ? (
          <>
            <button
              type="button"
              className={styles.googleBtn}
              disabled={loading}
              onClick={() => void handleGoogleLogin()}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.8 9.1-9.2 0-.6-.1-1.1-.2-1.6H12z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className={styles.divider}>
              <span>or</span>
            </div>

            <div className={styles.modeTabs} role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'otp'}
                className={`${styles.modeTab} ${mode === 'otp' ? styles.modeTabActive : ''}`}
                onClick={() => {
                  setMode('otp');
                  setErrorMsg(null);
                }}
              >
                Email code / link
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'password'}
                className={`${styles.modeTab} ${mode === 'password' ? styles.modeTabActive : ''}`}
                onClick={() => {
                  setMode('password');
                  setErrorMsg(null);
                }}
              >
                Password
              </button>
            </div>

            {mode === 'otp' ? (
              otpSent ? (
                <form className={styles.form} onSubmit={(e) => void handleVerifyOtp(e)}>
                  <label className={styles.label}>
                    6-digit code from email
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className={styles.input}
                      placeholder="123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.currentTarget.value)}
                      required
                    />
                  </label>
                  <Button type="submit" fullWidth loading={loading} color="spruce">
                    Verify &amp; continue
                  </Button>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => {
                      setOtpSent(false);
                      setOtpCode('');
                      setInfoMsg(null);
                    }}
                  >
                    Use a different email
                  </button>
                </form>
              ) : (
                <form className={styles.form} onSubmit={(e) => void handleSendOtp(e)}>
                  <label className={styles.label}>
                    Email address
                    <input
                      type="email"
                      autoComplete="email"
                      className={styles.input}
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.currentTarget.value)}
                      required
                    />
                  </label>
                  <Button
                    type="submit"
                    fullWidth
                    loading={loading}
                    color="spruce"
                    leftSection={<Mail size={15} />}
                  >
                    Send sign-in code
                  </Button>
                </form>
              )
            ) : (
              <form className={styles.form} onSubmit={(e) => void handlePasswordAuth(e)}>
                <label className={styles.label}>
                  Email address
                  <input
                    type="email"
                    autoComplete="email"
                    className={styles.input}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.currentTarget.value)}
                    required
                  />
                </label>
                <label className={styles.label}>
                  Password
                  <input
                    type="password"
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    className={styles.input}
                    placeholder="••••••••"
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.currentTarget.value)}
                    required
                  />
                </label>
                <Button type="submit" fullWidth loading={loading} color="spruce">
                  {isSignUp ? 'Create account' : 'Log in'}
                </Button>
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => setIsSignUp((v) => !v)}
                >
                  {isSignUp ? 'Already have an account? Log in' : 'New to Lyga? Create an account'}
                </button>
              </form>
            )}
          </>
        ) : (
          <form className={styles.form} onSubmit={(e) => void handleSendOtp(e)}>
            <label className={styles.label}>
              Local dev email
              <input
                type="email"
                className={styles.input}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                required
              />
            </label>
            <Button type="submit" fullWidth loading={loading} color="spruce">
              Continue in local dev →
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}

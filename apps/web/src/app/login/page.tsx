'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Loader } from '@mantine/core';
import { Eye, EyeOff, Lock, Mail, RefreshCw, X } from 'lucide-react';
import { validateAuthEmail } from '@/lib/email-validation';
import { useQrLoginSession } from '@/lib/mvp/use-qr-login';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import styles from './Login.module.css';

const LygaQrCode = dynamic(
  () => import('@/components/LygaQrCode').then((m) => m.LygaQrCode),
  { ssr: false }
);

type AuthMode = 'otp' | 'password';

export default function LoginPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<AuthMode>('otp');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { qrUrl, qrExpired, startQrSession } = useQrLoginSession({
    enabled: !checking,
    onApproved: () => router.replace('/app'),
    onError: (msg) => setErrorMsg(msg),
  });
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
    otp?: string;
  }>({});
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

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
    const check = validateAuthEmail(email);
    if (!check.valid) {
      setFieldErrors({ email: check.error ?? 'Please enter a valid email address.' });
      emailInputRef.current?.focus();
      return;
    }
    setFieldErrors({});
    const cleanEmail = check.normalized;

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
    const cleanCode = otpCode.trim();
    if (!cleanCode) {
      setFieldErrors({ otp: 'Enter the 6-digit code from your email.' });
      otpInputRef.current?.focus();
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: cleanCode,
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

  const handleEmailBlur = () => {
    if (!email.trim()) return;
    const check = validateAuthEmail(email);
    setFieldErrors((prev) => ({
      ...prev,
      email: check.valid ? undefined : (check.error ?? 'Please enter a valid email address.'),
    }));
  };

  const handlePasswordBlur = () => {
    if (!password) return;
    setFieldErrors((prev) => ({
      ...prev,
      password: password.length < 6 ? 'Password must be at least 6 characters.' : undefined,
    }));
  };

  const handleForgotPassword = async () => {
    if (!supabase) return;
    setErrorMsg(null);
    setInfoMsg(null);
    if (!email.trim()) {
      setFieldErrors({ email: 'Enter your email above to reset your password.' });
      emailInputRef.current?.focus();
      return;
    }
    const check = validateAuthEmail(email);
    if (!check.valid) {
      setFieldErrors({ email: check.error ?? 'Please enter a valid email address.' });
      emailInputRef.current?.focus();
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(check.normalized, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      if (error) {
        setErrorMsg(error.message);
        return;
      }
      setInfoMsg('If an account exists for that email, we sent a password reset link.');
    } catch {
      setErrorMsg('Unable to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setErrorMsg(null);
    setInfoMsg(null);
    const check = validateAuthEmail(email);
    const nextErrors: { email?: string; password?: string } = {};
    if (!check.valid) {
      nextErrors.email = check.error ?? 'Please enter a valid email address.';
    }
    if (password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters.';
    }
    if (nextErrors.email || nextErrors.password) {
      setFieldErrors(nextErrors);
      if (nextErrors.email) {
        emailInputRef.current?.focus();
      } else {
        passwordInputRef.current?.focus();
      }
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: check.normalized,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) {
          setErrorMsg(error.message);
          return;
        }
        if (data.session?.access_token) {
          await exchangeSession(data.session.access_token);
        } else if (data.user?.identities && data.user.identities.length === 0) {
          setIsSignUp(false);
          setPassword('');
          setErrorMsg('An account with this email already exists. Log in or use Email code.');
        } else {
          setIsSignUp(false);
          setPassword('');
          setInfoMsg('Account created! Check your email to confirm, then log in.');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: check.normalized,
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
      <div className={styles.shell}>
        <div className={styles.card}>
          <div className={styles.topRow}>
            <Link href="/" className={styles.brand}>
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
            <span className={styles.e2eeBadge}>
              <Lock size={11} aria-hidden="true" />
              Encrypted
            </span>
          </div>

          <h1 className={styles.title}>
            {supabase && mode === 'password'
              ? isSignUp
                ? 'Create a new account'
                : 'Log in to Lyga'
              : 'Sign in or sign up'}
          </h1>

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
                  setInfoMsg(null);
                  setFieldErrors({});
                }}
              >
                Email code
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'password'}
                className={`${styles.modeTab} ${mode === 'password' ? styles.modeTabActive : ''}`}
                onClick={() => {
                  setMode('password');
                  setErrorMsg(null);
                  setInfoMsg(null);
                  setFieldErrors({});
                }}
              >
                Password
              </button>
            </div>

            {mode === 'otp' ? (
              otpSent ? (
                <form className={styles.form} noValidate onSubmit={(e) => void handleVerifyOtp(e)}>
                  {infoMsg && (
                    <div className={styles.infoBanner} role="status">
                      <span>{infoMsg}</span>
                    </div>
                  )}
                  <label className={styles.label}>
                    6-digit code from email
                    <input
                      ref={otpInputRef}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      aria-invalid={Boolean(fieldErrors.otp)}
                      aria-describedby={fieldErrors.otp ? 'login-otp-error' : undefined}
                      className={`${styles.input} ${fieldErrors.otp ? styles.inputError : ''}`}
                      placeholder="123456"
                      value={otpCode}
                      onChange={(e) => {
                        setOtpCode(e.currentTarget.value);
                        if (fieldErrors.otp) setFieldErrors((prev) => ({ ...prev, otp: undefined }));
                        if (errorMsg) setErrorMsg(null);
                      }}
                      required
                    />
                    {fieldErrors.otp && (
                      <p id="login-otp-error" className={styles.fieldError} role="alert">
                        {fieldErrors.otp}
                      </p>
                    )}
                  </label>
                  {errorMsg && (
                    <div className={styles.errorBanner} role="alert">
                      <span>{errorMsg}</span>
                      <button
                        type="button"
                        className={styles.bannerClose}
                        aria-label="Dismiss error"
                        onClick={() => setErrorMsg(null)}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  )}
                  <Button
                    type="submit"
                    fullWidth
                    loading={loading}
                    className={styles.primaryBtn}
                  >
                    Verify &amp; continue →
                  </Button>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => {
                      setOtpSent(false);
                      setOtpCode('');
                      setInfoMsg(null);
                      setErrorMsg(null);
                      setFieldErrors({});
                    }}
                  >
                    Use a different email
                  </button>
                </form>
              ) : (
                <form className={styles.form} noValidate onSubmit={(e) => void handleSendOtp(e)}>
                  <label className={styles.label}>
                    Email address
                    <input
                      ref={emailInputRef}
                      type="email"
                      autoComplete="email"
                      aria-invalid={Boolean(fieldErrors.email)}
                      aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                      className={`${styles.input} ${fieldErrors.email ? styles.inputError : ''}`}
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.currentTarget.value);
                        if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                        if (errorMsg) setErrorMsg(null);
                      }}
                      onBlur={handleEmailBlur}
                      required
                    />
                    {fieldErrors.email && (
                      <p id="login-email-error" className={styles.fieldError} role="alert">
                        {fieldErrors.email}
                      </p>
                    )}
                  </label>
                  {errorMsg && (
                    <div className={styles.errorBanner} role="alert">
                      <span>{errorMsg}</span>
                      <button
                        type="button"
                        className={styles.bannerClose}
                        aria-label="Dismiss error"
                        onClick={() => setErrorMsg(null)}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  )}
                  <Button
                    type="submit"
                    fullWidth
                    loading={loading}
                    className={styles.primaryBtn}
                    leftSection={<Mail size={15} />}
                  >
                    Send sign-in code →
                  </Button>
                </form>
              )
            ) : (
              <form className={styles.form} noValidate onSubmit={(e) => void handlePasswordAuth(e)}>
                <label className={styles.label}>
                  Email address
                  <input
                    ref={emailInputRef}
                    type="email"
                    autoComplete="email"
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                    className={`${styles.input} ${fieldErrors.email ? styles.inputError : ''}`}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.currentTarget.value);
                      if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                      if (errorMsg) setErrorMsg(null);
                    }}
                    onBlur={handleEmailBlur}
                    required
                  />
                  {fieldErrors.email && (
                    <p id="login-email-error" className={styles.fieldError} role="alert">
                      {fieldErrors.email}
                    </p>
                  )}
                </label>
                <label className={styles.label}>
                  <span className={styles.labelRow}>
                    <span>Password</span>
                    {!isSignUp && (
                      <button
                        type="button"
                        className={styles.inlineLinkBtn}
                        disabled={loading}
                        onClick={() => void handleForgotPassword()}
                      >
                        Forgot password?
                      </button>
                    )}
                  </span>
                  <div className={styles.passwordWrap}>
                    <input
                      ref={passwordInputRef}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                      aria-invalid={Boolean(fieldErrors.password)}
                      aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                      className={`${styles.input} ${styles.passwordInput} ${fieldErrors.password ? styles.inputError : ''}`}
                      placeholder="••••••••"
                      minLength={6}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.currentTarget.value);
                        if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                        if (errorMsg) setErrorMsg(null);
                      }}
                      onBlur={handlePasswordBlur}
                      required
                    />
                    <button
                      type="button"
                      className={styles.eyeBtn}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p id="login-password-error" className={styles.fieldError} role="alert">
                      {fieldErrors.password}
                    </p>
                  )}
                </label>
                {infoMsg && (
                  <div className={styles.infoBanner} role="status">
                    <span>{infoMsg}</span>
                  </div>
                )}
                {errorMsg && (
                  <div className={styles.errorBanner} role="alert">
                    <span>{errorMsg}</span>
                    <button
                      type="button"
                      className={styles.bannerClose}
                      aria-label="Dismiss error"
                      onClick={() => setErrorMsg(null)}
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}
                <Button
                  type="submit"
                  fullWidth
                  loading={loading}
                  className={styles.primaryBtn}
                >
                  {isSignUp ? 'Create account →' : 'Log in →'}
                </Button>
                <div className={styles.authSwitchRow}>
                  <span className={styles.authSwitchHint}>
                    {isSignUp ? 'Already have an account?' : 'New to Lyga?'}
                  </span>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => {
                      setIsSignUp((v) => !v);
                      setPassword('');
                      setShowPassword(false);
                      setErrorMsg(null);
                      setInfoMsg(null);
                      setFieldErrors({});
                    }}
                  >
                    {isSignUp ? 'Log in' : 'Create new account'}
                  </button>
                </div>
              </form>
            )}
          </>
        ) : (
          <form className={styles.form} noValidate onSubmit={(e) => void handleSendOtp(e)}>
            <label className={styles.label}>
              Local dev email
              <input
                ref={emailInputRef}
                type="email"
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                className={`${styles.input} ${fieldErrors.email ? styles.inputError : ''}`}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.currentTarget.value);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  if (errorMsg) setErrorMsg(null);
                }}
                onBlur={handleEmailBlur}
                required
              />
              {fieldErrors.email && (
                <p id="login-email-error" className={styles.fieldError} role="alert">
                  {fieldErrors.email}
                </p>
              )}
            </label>
            {errorMsg && (
              <div className={styles.errorBanner} role="alert">
                <span>{errorMsg}</span>
                <button
                  type="button"
                  className={styles.bannerClose}
                  aria-label="Dismiss error"
                  onClick={() => setErrorMsg(null)}
                >
                  <X size={15} />
                </button>
              </div>
            )}
            <Button
              type="submit"
              fullWidth
              loading={loading}
              className={styles.primaryBtn}
            >
              Continue in local dev →
            </Button>
          </form>
        )}
        </div>

        <aside className={styles.qrPanel} aria-label="Unlock with your phone">
          <div className={styles.qrStage}>
            <span className={`${styles.cornerBracket} ${styles.cornerTL}`} aria-hidden="true" />
            <span className={`${styles.cornerBracket} ${styles.cornerTR}`} aria-hidden="true" />
            <span className={`${styles.cornerBracket} ${styles.cornerBL}`} aria-hidden="true" />
            <span className={`${styles.cornerBracket} ${styles.cornerBR}`} aria-hidden="true" />

            <div className={styles.qrFrame}>
              {qrUrl && !qrExpired ? (
                <LygaQrCode value={qrUrl} size={184} />
              ) : (
                <div className={styles.qrPlaceholder}>
                  {qrExpired ? (
                    <button
                      type="button"
                      className={styles.qrRefreshBtn}
                      onClick={() => void startQrSession()}
                    >
                      <RefreshCw size={16} />
                      <span>Refresh QR</span>
                    </button>
                  ) : (
                    <Loader color="spruce" size="sm" />
                  )}
                </div>
              )}
            </div>
          </div>

          <h2 className={styles.qrTitle}>Scan with your phone</h2>
          <p className={styles.qrCopy}>
            Signed in on your phone? Scan to unlock this browser.
          </p>
        </aside>
      </div>
    </main>
  );
}

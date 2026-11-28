'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader } from '@mantine/core';
import { Eye, EyeOff, Mail } from 'lucide-react';
import { validateAuthEmail } from '@/lib/email-validation';
import {
  generateWorkspaceKey,
  unwrapWorkspaceKey,
  wrapWorkspaceKey,
  type WrappedWorkspaceKey,
} from '@/lib/mvp/crypto';
import { getWorkspaceKey, saveWorkspaceKey } from '@/lib/mvp/key-store';
import { useQrLoginSession } from '@/lib/mvp/use-qr-login';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import {
  AuthEmailField,
  AuthErrorBanner,
  AuthSubmitButton,
  EncryptedBadge,
  QrUnlockPanel,
  TroubleSigningInHelp,
  formatAuthError,
} from './LoginFields';
import {
  OTP_COOLDOWN_SECONDS,
  clearOtpState,
  loadOtpState,
  remainingCooldown,
  saveOtpState,
} from './login-otp-storage';
import styles from './Login.module.css';

type AuthMode = 'otp' | 'password';

export default function LoginPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  const [mode, setMode] = useState<AuthMode>('otp');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [secondaryLoading, setSecondaryLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isDesktopQr, setIsDesktopQr] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrPaired, setQrPaired] = useState(false);
  const redirectTimerRef = useRef<number | null>(null);
  const { qrUrl, qrExpired, startQrSession } = useQrLoginSession({
    enabled: isDesktopQr,
    onApproved: () => {
      setQrPaired(true);
      redirectTimerRef.current = window.setTimeout(() => router.replace('/app'), 320);
    },
    onError: (msg) => {
      setQrError(msg);
    },
  });
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
    otp?: string;
  }>({});
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [requestedPlan, setRequestedPlan] = useState<'free' | 'pro' | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const plan = new URLSearchParams(window.location.search).get('plan');
    if (plan === 'pro' || plan === 'free') {
      setRequestedPlan(plan);
    }

    const mediaQuery = window.matchMedia('(min-width: 761px)');
    setIsDesktopQr(mediaQuery.matches);
    const onMediaChange = (e: MediaQueryListEvent) => setIsDesktopQr(e.matches);
    mediaQuery.addEventListener('change', onMediaChange);

    const stored = loadOtpState();
    if (stored) {
      setEmail(stored.email);
      setOtpSent(true);
      setInfoMsg(`Enter the 6-digit code we sent to ${stored.email}.`);
      const remaining = remainingCooldown(stored.sentAt);
      if (remaining > 0) setOtpCooldown(remaining);
    }

    return () => mediaQuery.removeEventListener('change', onMediaChange);
  }, []);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) window.clearTimeout(redirectTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);
    fetch('/api/auth/session', { cache: 'no-store', signal: controller.signal })
      .then((res) => {
        if (!active) return;
        if (res.ok) {
          router.replace('/app');
        }
      })
      .catch(() => {
        // Stay on /login when session check fails or times out
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
      });
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [router]);

  const syncWrappedKeyForPasswordAuth = async (passwordForWrap: string) => {
    try {
      const keyRes = await fetch('/api/mvp/workspace/key', { cache: 'no-store' });
      if (!keyRes.ok) return;
      const data = (await keyRes.json()) as {
        workspaceId?: string;
        hasWrappedKey?: boolean;
        wrappedKey?: WrappedWorkspaceKey | null;
      };
      if (!data.workspaceId) return;

      const localWmk = await getWorkspaceKey(data.workspaceId);
      if (data.hasWrappedKey && data.wrappedKey) {
        if (!localWmk && data.wrappedKey.kind === 'password') {
          try {
            const wmk = await unwrapWorkspaceKey(
              data.wrappedKey,
              passwordForWrap,
              data.workspaceId
            );
            await saveWorkspaceKey(data.workspaceId, wmk);
          } catch {
            // Password may have been reset without re-wrapping; /app unlock banner handles fallback.
          }
        }
        return;
      }

      const wmk = localWmk || (await generateWorkspaceKey());
      if (!localWmk) {
        await saveWorkspaceKey(data.workspaceId, wmk);
      }
      const wrapped = await wrapWorkspaceKey(wmk, passwordForWrap, data.workspaceId, 'password');
      await fetch('/api/mvp/workspace/key', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wrapped),
      });
    } catch {
      // Non-fatal: /app unlock flow handles recovery if key sync fails.
    }
  };

  const exchangeSession = async (accessToken: string, passwordForWrap?: string) => {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(err?.error ?? 'Unable to complete sign-in.');
    }
    if (passwordForWrap) {
      await syncWrappedKeyForPasswordAuth(passwordForWrap);
    }
    clearOtpState();
    router.replace('/app');
  };

  const handleGoogleLogin = async () => {
    if (!supabase) return;
    setErrorMsg(null);
    setGoogleError(null);
    setLoading(true);
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setGoogleError(formatAuthError(error.message, 'Unable to start Google sign-in.'));
        setGoogleLoading(false);
        setLoading(false);
      }
      // On success the browser navigates to Google; keep the button busy until it does.
    } catch (err) {
      setGoogleError(
        formatAuthError(
          err instanceof Error ? err.message : null,
          'Unable to start Google sign-in.'
        )
      );
      setGoogleLoading(false);
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
        setErrorMsg(formatAuthError(error.message, 'Unable to send sign-in email.'));
        return;
      }
      setOtpSent(true);
      setOtpCooldown(OTP_COOLDOWN_SECONDS);
      setInfoMsg(`Enter the 6-digit code we sent to ${cleanEmail}.`);
      saveOtpState(cleanEmail);
    } catch {
      setErrorMsg('Unable to send sign-in email.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = window.setTimeout(() => setOtpCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [otpCooldown]);

  useEffect(() => {
    if (!otpSent) return;
    const timer = window.setTimeout(() => otpInputRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [otpSent]);

  const handleResendOtp = async () => {
    if (!supabase || otpCooldown > 0 || loading || secondaryLoading) return;
    const check = validateAuthEmail(email);
    if (!check.valid) {
      setFieldErrors({ email: check.error ?? 'Please enter a valid email address.' });
      setOtpSent(false);
      window.requestAnimationFrame(() => emailInputRef.current?.focus());
      return;
    }
    setErrorMsg(null);
    setSecondaryLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: check.normalized,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setErrorMsg(formatAuthError(error.message, 'Unable to resend sign-in email.'));
        return;
      }
      setOtpCooldown(OTP_COOLDOWN_SECONDS);
      setInfoMsg(`Sent a fresh 6-digit code to ${check.normalized}.`);
      saveOtpState(check.normalized);
    } catch {
      setErrorMsg('Unable to resend sign-in email.');
    } finally {
      setSecondaryLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setErrorMsg(null);
    const cleanCode = otpCode.trim();
    if (cleanCode.length !== 6) {
      setFieldErrors({ otp: 'Enter the 6-digit code from your email.' });
      otpInputRef.current?.focus();
      return;
    }
    setFieldErrors({});
    setLoading(true);
    const emailCheck = validateAuthEmail(email);
    const normalizedEmail = emailCheck.valid ? emailCheck.normalized : email.trim().toLowerCase();
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: cleanCode,
        type: 'email',
      });
      if (error || !data.session?.access_token) {
        setErrorMsg(formatAuthError(error?.message, 'Invalid or expired code.'));
        return;
      }
      await exchangeSession(data.session.access_token);
    } catch (err) {
      setErrorMsg(
        formatAuthError(err instanceof Error ? err.message : null, 'Unable to verify code.')
      );
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
    setSecondaryLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(check.normalized, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) {
        setErrorMsg(formatAuthError(error.message, 'Unable to send password reset email.'));
        return;
      }
      setInfoMsg('If an account exists for that email, we sent a password reset link.');
    } catch {
      setErrorMsg('Unable to send password reset email.');
    } finally {
      setSecondaryLoading(false);
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
          setErrorMsg(formatAuthError(error.message, 'Unable to create account.'));
          return;
        }
        if (data.session?.access_token) {
          await exchangeSession(data.session.access_token, password);
        } else if (data.user?.identities && data.user.identities.length === 0) {
          setIsSignUp(false);
          setPassword('');
          setErrorMsg('An account with this email already exists. Sign in or use Email code.');
        } else {
          setIsSignUp(false);
          setPassword('');
          setInfoMsg('Account created! Check your email to confirm, then sign in.');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: check.normalized,
          password,
        });
        if (error || !data.session?.access_token) {
          setErrorMsg(formatAuthError(error?.message, 'Incorrect email or password.'));
          return;
        }
        await exchangeSession(data.session.access_token, password);
      }
    } catch (err) {
      setErrorMsg(
        formatAuthError(err instanceof Error ? err.message : null, 'Authentication failed.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.card}>
          <div className={styles.topRow}>
            <Link href="/" className={styles.brand} aria-label="LYGA — Back to home">
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
            <EncryptedBadge />
          </div>

          <h1 className={styles.title}>
            {supabase && mode === 'password'
              ? isSignUp
                ? 'Create a new account'
                : 'Sign in to Lyga'
              : 'Sign in or sign up'}
          </h1>
          {requestedPlan === 'pro' && (
            <p className={styles.planNotice}>
              Sign in to continue with Lyga Pro (Founder Rate).
            </p>
          )}

        {supabase ? (
          <>
            <button
              type="button"
              className={styles.googleBtn}
              disabled={loading}
              aria-busy={googleLoading}
              onClick={() => void handleGoogleLogin()}
            >
              {googleLoading ? (
                <Loader size={16} color="white" aria-hidden="true" />
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.2 0 6-1.1 8-3l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.2 0-5.9-2.1-6.8-5H1.2v3.1C3.2 21.3 7.3 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.2 14.2c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2V6.7H1.2C.4 8.3 0 10.1 0 12s.4 3.7 1.2 5.3l4-3.1z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.5-3.5C18 1.1 15.2 0 12 0 7.3 0 3.2 2.7 1.2 6.7l4 3.1c.9-2.9 3.6-5 6.8-5z"
                  />
                </svg>
              )}
              <span>{googleLoading ? 'Connecting to Google…' : 'Continue with Google'}</span>
            </button>

            {googleError && (
              <AuthErrorBanner message={googleError} onDismiss={() => setGoogleError(null)} />
            )}

            <div className={styles.divider}>
              <span>or</span>
            </div>

            <div
              className={styles.modeTabs}
              data-mode={mode}
              role="tablist"
              aria-label="Sign-in method"
              onKeyDown={(e) => {
                if (loading) return;
                if (
                  e.key !== 'ArrowLeft' &&
                  e.key !== 'ArrowRight' &&
                  e.key !== 'Home' &&
                  e.key !== 'End'
                ) {
                  return;
                }
                e.preventDefault();
                const nextMode: AuthMode =
                  e.key === 'Home'
                    ? 'otp'
                    : e.key === 'End'
                      ? 'password'
                      : mode === 'otp'
                        ? 'password'
                        : 'otp';
                setMode(nextMode);
                setErrorMsg(null);
                setGoogleError(null);
                if (nextMode === 'otp' && otpSent) {
                  const check = validateAuthEmail(email);
                  const target = check.valid ? check.normalized : email.trim().toLowerCase();
                  setInfoMsg(`Enter the 6-digit code we sent to ${target}.`);
                } else {
                  setInfoMsg(null);
                }
                setFieldErrors({});
                document.getElementById(`tab-${nextMode}`)?.focus();
              }}
            >
              <div className={styles.tabSlider} aria-hidden="true" />
              <button
                id="tab-otp"
                type="button"
                role="tab"
                disabled={loading}
                aria-selected={mode === 'otp'}
                aria-controls="login-auth-panel"
                tabIndex={mode === 'otp' ? 0 : -1}
                className={`${styles.modeTab} ${mode === 'otp' ? styles.modeTabActive : ''}`}
                onClick={() => {
                  setMode('otp');
                  setErrorMsg(null);
                  setGoogleError(null);
                  if (otpSent) {
                    const check = validateAuthEmail(email);
                    const target = check.valid ? check.normalized : email.trim().toLowerCase();
                    setInfoMsg(`Enter the 6-digit code we sent to ${target}.`);
                  } else {
                    setInfoMsg(null);
                  }
                  setFieldErrors({});
                }}
              >
                Email code
              </button>
              <button
                id="tab-password"
                type="button"
                role="tab"
                disabled={loading}
                aria-selected={mode === 'password'}
                aria-controls="login-auth-panel"
                tabIndex={mode === 'password' ? 0 : -1}
                className={`${styles.modeTab} ${mode === 'password' ? styles.modeTabActive : ''}`}
                onClick={() => {
                  setMode('password');
                  setErrorMsg(null);
                  setGoogleError(null);
                  setInfoMsg(null);
                  setFieldErrors({});
                }}
              >
                Password
              </button>
            </div>

            <div
              id="login-auth-panel"
              role="tabpanel"
              aria-labelledby={mode === 'otp' ? 'tab-otp' : 'tab-password'}
            >

            {mode === 'otp' ? (
              otpSent ? (
                <form className={styles.form} noValidate onSubmit={(e) => void handleVerifyOtp(e)}>
                  {infoMsg && (
                    <div className={styles.infoBanner} role="status">
                      <span>{infoMsg}</span>
                    </div>
                  )}
                  <div className={styles.fieldGroup}>
                    <label htmlFor="login-otp-code" className={styles.label}>
                      6-digit code from email
                    </label>
                    <input
                      id="login-otp-code"
                      ref={otpInputRef}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      aria-invalid={Boolean(fieldErrors.otp)}
                      aria-describedby={fieldErrors.otp ? 'login-otp-error' : undefined}
                      className={`${styles.input} ${styles.otpInput} ${fieldErrors.otp ? styles.inputError : ''}`}
                      placeholder="123456"
                      value={otpCode}
                      onChange={(e) => {
                        setOtpCode(e.currentTarget.value.replace(/\D/g, '').slice(0, 6));
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
                  </div>
                  {errorMsg && <AuthErrorBanner message={errorMsg} onDismiss={() => setErrorMsg(null)} />}
                  <AuthSubmitButton loading={loading} disabled={loading || secondaryLoading}>
                    Verify &amp; continue
                  </AuthSubmitButton>
                  <div className={styles.otpActionsRow}>
                    <button
                      type="button"
                      className={styles.linkBtn}
                      disabled={loading || secondaryLoading || otpCooldown > 0}
                      onClick={() => void handleResendOtp()}
                    >
                      {secondaryLoading
                        ? 'Resending…'
                        : otpCooldown > 0
                          ? `Resend code (${otpCooldown}s)`
                          : 'Resend code'}
                    </button>
                    <button
                      type="button"
                      className={styles.linkBtn}
                      disabled={loading}
                      onClick={() => {
                        setOtpSent(false);
                        setOtpCode('');
                        setOtpCooldown(0);
                        setInfoMsg(null);
                        setErrorMsg(null);
                        setFieldErrors({});
                        clearOtpState();
                        window.requestAnimationFrame(() => emailInputRef.current?.focus());
                      }}
                    >
                      Use a different email
                    </button>
                  </div>
                </form>
              ) : (
                <form className={styles.form} noValidate onSubmit={(e) => void handleSendOtp(e)}>
                  <AuthEmailField
                    id="login-otp-email"
                    inputRef={emailInputRef}
                    value={email}
                    error={fieldErrors.email}
                    onChangeValue={(value) => {
                      setEmail(value);
                      if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                      if (errorMsg) setErrorMsg(null);
                    }}
                    onBlur={handleEmailBlur}
                  />
                  {errorMsg && <AuthErrorBanner message={errorMsg} onDismiss={() => setErrorMsg(null)} />}
                  <AuthSubmitButton
                    loading={loading}
                    disabled={loading || secondaryLoading}
                    icon={<Mail size={15} aria-hidden="true" />}
                  >
                    Send sign-in code
                  </AuthSubmitButton>
                </form>
              )
            ) : (
              <form className={styles.form} noValidate onSubmit={(e) => void handlePasswordAuth(e)}>
                <AuthEmailField
                  id="login-password-email"
                  inputRef={emailInputRef}
                  value={email}
                  error={fieldErrors.email}
                  onChangeValue={(value) => {
                    setEmail(value);
                    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    if (errorMsg) setErrorMsg(null);
                  }}
                  onBlur={handleEmailBlur}
                />
                <div className={styles.fieldGroup}>
                  <div className={styles.labelRow}>
                    <label htmlFor="login-password" className={styles.label}>
                      Password
                    </label>
                    {!isSignUp && (
                      <button
                        type="button"
                        className={styles.inlineLinkBtn}
                        disabled={loading || secondaryLoading}
                        onClick={() => void handleForgotPassword()}
                      >
                        {secondaryLoading ? 'Sending reset link…' : 'Forgot password?'}
                      </button>
                    )}
                  </div>
                  <div className={styles.passwordWrap}>
                    <input
                      id="login-password"
                      ref={passwordInputRef}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                      aria-invalid={Boolean(fieldErrors.password)}
                      aria-describedby={
                        fieldErrors.password
                          ? 'login-password-error'
                          : isSignUp
                            ? 'login-password-hint'
                            : undefined
                      }
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
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                    </button>
                  </div>
                  {fieldErrors.password ? (
                    <p id="login-password-error" className={styles.fieldError} role="alert">
                      {fieldErrors.password}
                    </p>
                  ) : isSignUp ? (
                    <p id="login-password-hint" className={styles.fieldHint}>
                      At least 6 characters
                    </p>
                  ) : null}
                </div>
                {infoMsg && (
                  <div className={styles.infoBanner} role="status">
                    <span>{infoMsg}</span>
                  </div>
                )}
                {errorMsg && <AuthErrorBanner message={errorMsg} onDismiss={() => setErrorMsg(null)} />}
                <AuthSubmitButton loading={loading} disabled={loading || secondaryLoading}>
                  {isSignUp ? 'Create account' : 'Sign in'}
                </AuthSubmitButton>
                <div className={styles.authSwitchRow}>
                  <span className={styles.authSwitchHint}>
                    {isSignUp ? 'Already have an account?' : 'New to Lyga?'}
                  </span>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    disabled={loading}
                    onClick={() => {
                      setIsSignUp((v) => !v);
                      setPassword('');
                      setShowPassword(false);
                      setErrorMsg(null);
                      setInfoMsg(null);
                      setFieldErrors({});
                    }}
                  >
                    {isSignUp ? 'Sign in' : 'Create new account'}
                  </button>
                </div>
              </form>
            )}
            </div>
          </>
        ) : (
          <form className={styles.form} noValidate onSubmit={(e) => void handleSendOtp(e)}>
            <AuthEmailField
              id="login-dev-email"
              label="Local dev email"
              inputRef={emailInputRef}
              value={email}
              error={fieldErrors.email}
              onChangeValue={(value) => {
                setEmail(value);
                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                if (errorMsg) setErrorMsg(null);
              }}
              onBlur={handleEmailBlur}
            />
            {errorMsg && <AuthErrorBanner message={errorMsg} onDismiss={() => setErrorMsg(null)} />}
            <AuthSubmitButton loading={loading} disabled={loading || secondaryLoading}>
              Continue in local dev
            </AuthSubmitButton>
          </form>
        )}

          <TroubleSigningInHelp />
        </div>

        <QrUnlockPanel
          qrUrl={qrUrl}
          qrExpired={qrExpired}
          qrError={qrError}
          qrPaired={qrPaired}
          onRetry={() => {
            setQrError(null);
            void startQrSession();
          }}
        />
      </div>
    </main>
  );
}

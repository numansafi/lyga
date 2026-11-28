'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import styles from './Login.module.css';

const PASSWORD_RULES = [
  { id: 'len', label: '8+ characters', test: (p: string) => p.length >= 8 },
  { id: 'lower', label: 'Lowercase', test: (p: string) => /[a-z]/.test(p) },
  { id: 'upper', label: 'Uppercase', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'digit', label: 'Number', test: (p: string) => /\d/.test(p) },
  { id: 'symbol', label: 'Symbol', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function validateSignUpPassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[a-z]/.test(pw)) return 'Include at least one lowercase letter.';
  if (!/[A-Z]/.test(pw)) return 'Include at least one uppercase letter.';
  if (!/\d/.test(pw)) return 'Include at least one number.';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Include at least one symbol (e.g. !@#$%).';
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  const [isSignUp, setIsSignUp] = useState(false);
  const [pendingConfirmEmail, setPendingConfirmEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [secondaryLoading, setSecondaryLoading] = useState(false);
  const [isDesktopQr, setIsDesktopQr] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
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
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [requestedPlan, setRequestedPlan] = useState<'free' | 'pro' | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const plan = new URLSearchParams(window.location.search).get('plan');
    if (plan === 'pro' || plan === 'free') {
      setRequestedPlan(plan);
    }

    const mediaQuery = window.matchMedia('(min-width: 761px)');
    setIsDesktopQr(mediaQuery.matches);
    const onMediaChange = (e: MediaQueryListEvent) => setIsDesktopQr(e.matches);
    mediaQuery.addEventListener('change', onMediaChange);

    return () => mediaQuery.removeEventListener('change', onMediaChange);
  }, []);

  useEffect(() => {
    if (!infoMsg) return;
    const timer = window.setTimeout(() => setInfoMsg(null), 4000);
    return () => window.clearTimeout(timer);
  }, [infoMsg]);

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
    router.replace('/app');
  };

  const handleDevLogin = async (e: React.FormEvent) => {
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
    setLoading(true);
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devEmail: check.normalized }),
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
      password: isSignUp
        ? (validateSignUpPassword(password) ?? undefined)
        : password.length < 6
          ? 'Password must be at least 6 characters.'
          : undefined,
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
    const nextErrors: {
      name?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};
    if (isSignUp && !fullName.trim()) {
      nextErrors.name = 'Please enter your name.';
    }
    if (!check.valid) {
      nextErrors.email = check.error ?? 'Please enter a valid email address.';
    }
    if (isSignUp) {
      const pwError = validateSignUpPassword(password);
      if (pwError) nextErrors.password = pwError;
      if (confirmPassword !== password) {
        nextErrors.confirmPassword = 'Passwords do not match.';
      }
    } else if (password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters.';
    }
    if (nextErrors.name || nextErrors.email || nextErrors.password || nextErrors.confirmPassword) {
      setFieldErrors(nextErrors);
      if (nextErrors.name) {
        nameInputRef.current?.focus();
      } else if (nextErrors.email) {
        emailInputRef.current?.focus();
      } else if (nextErrors.password) {
        passwordInputRef.current?.focus();
      } else {
        confirmPasswordRef.current?.focus();
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
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: { full_name: fullName.trim() },
          },
        });
        if (error) {
          setErrorMsg(formatAuthError(error.message, 'Unable to create account.'));
          return;
        }
        if (data.session?.access_token && data.user?.email_confirmed_at) {
          await exchangeSession(data.session.access_token, password);
        } else if (data.user?.identities && data.user.identities.length === 0) {
          setIsSignUp(false);
          setPassword('');
          setConfirmPassword('');
          setErrorMsg('An account with this email already exists. Sign in instead.');
        } else {
          if (data.session) {
            await supabase.auth.signOut().catch(() => undefined);
          }
          setIsSignUp(false);
          setFullName('');
          setPassword('');
          setConfirmPassword('');
          setPendingConfirmEmail(check.normalized);
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
      {infoMsg && (
        <div className={styles.floatingInfoToast} role="status" aria-live="polite">
          <span className={styles.floatingInfoDot} aria-hidden="true" />
          <span>{infoMsg}</span>
        </div>
      )}
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
            {pendingConfirmEmail
              ? 'Check your email'
              : supabase
                ? isSignUp
                  ? 'Create a new account'
                  : 'Sign in to Lyga'
                : 'Sign in to Lyga'}
          </h1>
          {requestedPlan === 'pro' && !pendingConfirmEmail && (
            <p className={styles.planNotice}>
              Sign in to continue with Lyga Pro (Founder Rate).
            </p>
          )}

        {pendingConfirmEmail && supabase ? (
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  void (async () => {
                    setErrorMsg(null);
                    setSecondaryLoading(true);
                    try {
                      const { error } = await supabase.auth.resend({
                        type: 'signup',
                        email: pendingConfirmEmail,
                        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
                      });
                      if (error) {
                        setErrorMsg(formatAuthError(error.message, 'Unable to resend confirmation email.'));
                      } else {
                        setInfoMsg(`Sent a new confirmation link to ${pendingConfirmEmail}.`);
                      }
                    } catch (err) {
                      setErrorMsg(
                        formatAuthError(
                          err instanceof Error ? err.message : null,
                          'Unable to resend confirmation email.'
                        )
                      );
                    } finally {
                      setSecondaryLoading(false);
                    }
                  })();
                }}
              >
                <div className={styles.otpSubtitle}>
                  <Mail size={16} aria-hidden="true" />
                  <span>
                    We sent a confirmation link to <strong>{pendingConfirmEmail}</strong>. Open the
                    link in your email to activate your account, then sign in.
                  </span>
                </div>
                {errorMsg && <AuthErrorBanner message={errorMsg} onDismiss={() => setErrorMsg(null)} />}
                <AuthSubmitButton loading={secondaryLoading} disabled={secondaryLoading}>
                  Resend confirmation email
                </AuthSubmitButton>
                <div className={styles.authSwitchRow}>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    disabled={secondaryLoading}
                    onClick={() => {
                      setEmail(pendingConfirmEmail);
                      setPendingConfirmEmail(null);
                      setIsSignUp(false);
                      setErrorMsg(null);
                      setInfoMsg(null);
                    }}
                  >
                    Back to sign in
                  </button>
                </div>
              </form>
        ) : supabase ? (
              <form
                key={isSignUp ? 'signup' : 'signin'}
                className={styles.form}
                noValidate
                onSubmit={(e) => void handlePasswordAuth(e)}
              >
                {isSignUp && (
                  <div className={styles.fieldGroup}>
                    <label htmlFor="login-name" className={styles.label}>
                      Name
                    </label>
                    <input
                      id="login-name"
                      ref={nameInputRef}
                      type="text"
                      autoComplete="name"
                      aria-invalid={Boolean(fieldErrors.name)}
                      aria-describedby={fieldErrors.name ? 'login-name-error' : undefined}
                      className={`${styles.input} ${fieldErrors.name ? styles.inputError : ''}`}
                      placeholder="Your name"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.currentTarget.value);
                        if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
                        if (errorMsg) setErrorMsg(null);
                      }}
                      required
                    />
                    {fieldErrors.name && (
                      <p id="login-name-error" className={styles.fieldError} role="alert">
                        {fieldErrors.name}
                      </p>
                    )}
                  </div>
                )}
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
                      placeholder={isSignUp ? 'Create a password' : 'Enter your password'}
                      minLength={isSignUp ? 8 : 6}
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
                    password.length > 0 ? (
                      <div id="login-password-hint" className={styles.pwChecklist} aria-live="polite">
                        {PASSWORD_RULES.map((rule) => {
                          const met = rule.test(password);
                          return (
                            <span
                              key={rule.id}
                              className={`${styles.pwRule} ${met ? styles.pwRuleMet : ''}`}
                            >
                              {met ? '✓' : '•'} {rule.label}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <p id="login-password-hint" className={styles.fieldHint}>
                        At least 8 characters with uppercase, lowercase, a number, and a symbol
                      </p>
                    )
                  ) : null}
                </div>
                {isSignUp && (
                  <div className={styles.fieldGroup}>
                    <label htmlFor="login-confirm-password" className={styles.label}>
                      Confirm password
                    </label>
                    <div className={styles.passwordWrap}>
                      <input
                        id="login-confirm-password"
                        ref={confirmPasswordRef}
                        type={showConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        aria-invalid={Boolean(fieldErrors.confirmPassword)}
                        aria-describedby={
                          fieldErrors.confirmPassword ? 'login-confirm-password-error' : undefined
                        }
                        className={`${styles.input} ${styles.passwordInput} ${fieldErrors.confirmPassword ? styles.inputError : ''}`}
                        placeholder="Re-enter your password"
                        minLength={8}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.currentTarget.value);
                          if (fieldErrors.confirmPassword) {
                            setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                          }
                          if (errorMsg) setErrorMsg(null);
                        }}
                        required
                      />
                      <button
                        type="button"
                        className={styles.eyeBtn}
                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                        aria-pressed={showConfirmPassword}
                        onClick={() => setShowConfirmPassword((v) => !v)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={16} aria-hidden="true" />
                        ) : (
                          <Eye size={16} aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    {fieldErrors.confirmPassword && (
                      <p id="login-confirm-password-error" className={styles.fieldError} role="alert">
                        {fieldErrors.confirmPassword}
                      </p>
                    )}
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
                      setFullName('');
                      setEmail('');
                      setPassword('');
                      setConfirmPassword('');
                      setShowPassword(false);
                      setShowConfirmPassword(false);
                      setErrorMsg(null);
                      setInfoMsg(null);
                      setFieldErrors({});
                    }}
                  >
                    {isSignUp ? 'Sign in' : 'Create new account'}
                  </button>
                </div>
              </form>
        ) : (
          <form className={styles.form} noValidate onSubmit={(e) => void handleDevLogin(e)}>
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

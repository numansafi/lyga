'use client';

import type { ReactNode, RefObject } from 'react';
import dynamic from 'next/dynamic';
import { Loader } from '@mantine/core';
import { Lock, RefreshCw, X } from 'lucide-react';
import styles from './Login.module.css';

const LygaQrCode = dynamic(
  () => import('@/components/LygaQrCode').then((m) => m.LygaQrCode),
  { ssr: false }
);

/** Map raw Supabase auth provider errors into plain-language recovery copy. */
export function formatAuthError(raw: string | undefined | null, fallback: string): string {
  const msg = raw?.trim() ?? '';
  if (!msg) return fallback;
  const lower = msg.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'Incorrect email or password. Try again or reset your password.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Please confirm your email address using the link we sent you before signing in.';
  }
  if (lower.includes('already registered') || lower.includes('already exists')) {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (lower.includes('token has expired') || lower.includes('otp_expired') || lower.includes('invalid token')) {
    return 'That link is invalid or expired. Request a new one and try again.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('security purposes')) {
    return 'Too many attempts right now. Wait a moment and try again.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Could not reach the sign-in service. Check your connection and try again.';
  }
  return msg;
}

interface AuthEmailFieldProps {
  id: string;
  label?: string;
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  error?: string;
  autoComplete?: string;
  onChangeValue: (value: string) => void;
  onBlur: () => void;
}

export function AuthEmailField({
  id,
  label = 'Email address',
  inputRef,
  value,
  error,
  autoComplete = 'email',
  onChangeValue,
  onBlur,
}: AuthEmailFieldProps) {
  return (
    <div className={styles.fieldGroup}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        type="email"
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${styles.input} ${error ? styles.inputError : ''}`}
        placeholder="you@example.com"
        value={value}
        onChange={(e) => onChangeValue(e.currentTarget.value)}
        onBlur={onBlur}
        required
      />
      {error && (
        <p id={`${id}-error`} className={styles.fieldError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface AuthErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

export function AuthErrorBanner({ message, onDismiss }: AuthErrorBannerProps) {
  return (
    <div className={styles.errorBanner} role="alert">
      <span>{message}</span>
      <button
        type="button"
        className={styles.bannerClose}
        aria-label="Dismiss error"
        onClick={onDismiss}
      >
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

interface QrUnlockPanelProps {
  qrUrl: string;
  qrExpired: boolean;
  qrError: string | null;
  qrPaired: boolean;
  onRetry: () => void;
}

export function QrUnlockPanel({
  qrUrl,
  qrExpired,
  qrError,
  qrPaired,
  onRetry,
}: QrUnlockPanelProps) {
  return (
    <aside className={styles.qrPanel} aria-label="Unlock with your phone">
      <div className={`${styles.qrStage} ${qrPaired ? styles.qrStagePaired : ''}`}>
        <span className={`${styles.cornerBracket} ${styles.cornerTL}`} aria-hidden="true" />
        <span className={`${styles.cornerBracket} ${styles.cornerTR}`} aria-hidden="true" />
        <span className={`${styles.cornerBracket} ${styles.cornerBL}`} aria-hidden="true" />
        <span className={`${styles.cornerBracket} ${styles.cornerBR}`} aria-hidden="true" />

        <div className={styles.qrFrame}>
          {qrUrl && !qrExpired && !qrError ? (
            <>
              <LygaQrCode value={qrUrl} size={184} />
              {qrPaired && (
                <div className={styles.qrScanSuccess} role="status">
                  <span>✓ Device paired</span>
                  <span className={styles.qrScanSub}>Unlocking workspace…</span>
                </div>
              )}
            </>
          ) : (
            <div className={styles.qrPlaceholder}>
              {qrExpired || qrError ? (
                <div className={styles.qrRetryWrap}>
                  <p
                    className={qrError ? styles.qrErrorText : styles.qrExpiredText}
                    role={qrError ? 'alert' : 'status'}
                  >
                    {qrError ?? 'QR code expired'}
                  </p>
                  <button type="button" className={styles.qrRefreshBtn} onClick={onRetry}>
                    <RefreshCw size={16} aria-hidden="true" />
                    <span>{qrError ? 'Retry QR' : 'Refresh QR'}</span>
                  </button>
                </div>
              ) : (
                <Loader color="spruce" size="sm" role="status" aria-label="Loading QR code" />
              )}
            </div>
          )}
        </div>
      </div>

      <h2 className={styles.qrTitle}>Scan with your phone</h2>
      <p className={styles.qrCopy}>
        Already signed in on your phone? Open Lyga and scan to unlock this browser.
      </p>
    </aside>
  );
}

interface AuthSubmitButtonProps {
  loading: boolean;
  disabled: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

/** Primary submit button shared by every auth form (spruce fill, white label). */
export function AuthSubmitButton({ loading, disabled, icon, children }: AuthSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled}
      aria-busy={loading}
      className={styles.primaryBtn}
    >
      {loading ? <Loader size={15} color="white" aria-hidden="true" /> : icon}
      <span>{children}</span>
      <span aria-hidden="true">→</span>
    </button>
  );
}

/** Encryption badge. The explanation is real text (visually hidden), not an aria-label on a generic element. */
export function EncryptedBadge() {
  return (
    <span className={styles.e2eeBadge}>
      <span className={styles.pulseDot} aria-hidden="true" />
      <Lock size={11} aria-hidden="true" />
      <span>Encrypted</span>
      <span className={styles.srOnly}>— end-to-end, keys stay on your devices</span>
    </span>
  );
}

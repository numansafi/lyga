'use client';

import { useRef, type ClipboardEvent, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import dynamic from 'next/dynamic';
import { Loader } from '@mantine/core';
import { ChevronDown, Lock, RefreshCw, X } from 'lucide-react';
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
    return 'An account with this email already exists. Sign in or use Email code.';
  }
  if (lower.includes('token has expired') || lower.includes('otp_expired') || lower.includes('invalid token')) {
    return 'That code is invalid or expired. Request a fresh 6-digit code and try again.';
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

export function OtpDigitBoxes({
  id = 'login-otp-code',
  value,
  onChange,
  firstInputRef,
  hasError,
  errorId,
}: {
  id?: string;
  value: string;
  onChange: (nextCode: string) => void;
  firstInputRef?: RefObject<HTMLInputElement | null>;
  hasError?: boolean;
  errorId?: string;
}) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, i) => {
    const ch = value[i];
    return ch && /\d/.test(ch) ? ch : '';
  });

  const emitDigits = (slots: string[]) => {
    onChange(slots.map((d) => (d && /\d/.test(d) ? d : ' ')).join('').replace(/\s+$/, ''));
  };

  const setRef = (idx: number) => (el: HTMLInputElement | null) => {
    inputRefs.current[idx] = el;
    if (idx === 0 && firstInputRef) {
      firstInputRef.current = el;
    }
  };

  const focusBox = (idx: number) => {
    const clamped = Math.max(0, Math.min(5, idx));
    inputRefs.current[clamped]?.focus();
    inputRefs.current[clamped]?.select();
  };

  const handleDigitChange = (idx: number, raw: string) => {
    const clean = raw.replace(/\D/g, '');
    if (!clean) {
      const next = [...digits];
      next[idx] = '';
      emitDigits(next);
      return;
    }
    if (clean.length > 1) {
      // Multi-character input (autofill or paste via change)
      const next = [...digits];
      const start = clean.length >= 6 ? 0 : idx;
      for (let i = 0; i < clean.length && start + i < 6; i++) {
        next[start + i] = clean[i] ?? '';
      }
      emitDigits(next);
      focusBox(Math.min(5, start + clean.length));
      return;
    }
    const next = [...digits];
    next[idx] = clean;
    emitDigits(next);
    if (idx < 5) {
      focusBox(idx + 1);
    }
  };

  const handlePaste = (idx: number, e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;
    e.preventDefault();
    const next = [...digits];
    const start = pasted.length >= 6 ? 0 : idx;
    for (let i = 0; i < pasted.length && start + i < 6; i++) {
      next[start + i] = pasted[i] ?? '';
    }
    emitDigits(next);
    focusBox(Math.min(5, start + pasted.length - 1));
  };

  const handleKeyDown = (idx: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        const next = [...digits];
        next[idx] = '';
        emitDigits(next);
      } else if (idx > 0) {
        const next = [...digits];
        next[idx - 1] = '';
        emitDigits(next);
        focusBox(idx - 1);
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      focusBox(idx - 1);
    } else if (e.key === 'ArrowRight' && idx < 5) {
      e.preventDefault();
      focusBox(idx + 1);
    }
  };

  return (
    <div
      className={styles.otpGrid}
      role="group"
      aria-label="6-digit verification code"
      aria-describedby={hasError ? errorId : undefined}
    >
      {digits.map((digit, idx) => (
        <input
          key={idx}
          id={idx === 0 ? id : undefined}
          ref={setRef(idx)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={idx === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${idx + 1} of 6`}
          aria-invalid={Boolean(hasError)}
          className={`${styles.otpBox} ${hasError ? styles.otpBoxError : ''}`}
          value={digit}
          onChange={(e) => handleDigitChange(idx, e.currentTarget.value)}
          onPaste={(e) => handlePaste(idx, e)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          onFocus={(e) => e.currentTarget.select()}
        />
      ))}
    </div>
  );
}

export function TroubleSigningInHelp() {
  return (
    <details className={styles.helpDisclosure}>
      <summary className={styles.helpSummary}>
        <span>Trouble signing in?</span>
        <ChevronDown size={14} className={styles.helpChevron} aria-hidden="true" />
      </summary>
      <div className={styles.helpBody}>
        <p>
          <strong>Didn&apos;t get the code?</strong> Check your spam folder, or sign in with Google
          or a password using the same email.
        </p>
        <p>
          <strong>Your files stay private.</strong> Only your paired devices hold the key, so we
          can never read what you send.
        </p>
      </div>
    </details>
  );
}

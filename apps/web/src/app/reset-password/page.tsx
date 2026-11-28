'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@mantine/core';
import { Check, Eye, EyeOff, Lock, X } from 'lucide-react';
import { wrapWorkspaceKey } from '@/lib/mvp/crypto';
import { getWorkspaceKey } from '@/lib/mvp/key-store';
import {
  PASSWORD_REQUIREMENTS_HINT,
  validateStrongPassword,
} from '@/lib/password-validation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { formatAuthError } from '../login/LoginFields';
import loginStyles from '../login/Login.module.css';
import callbackStyles from '../auth/callback/Callback.module.css';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [reWrapNote, setReWrapNote] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setErrorMsg(null);
    const nextErrors: { password?: string; confirm?: string } = {};
    const pwCheck = validateStrongPassword(password);
    if (!pwCheck.valid) {
      nextErrors.password = pwCheck.error;
    }
    if (confirmPassword !== password) {
      nextErrors.confirm = 'Passwords do not match.';
    }
    if (nextErrors.password || nextErrors.confirm) {
      setFieldErrors(nextErrors);
      if (nextErrors.password) passwordRef.current?.focus();
      else confirmRef.current?.focus();
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMsg(formatAuthError(error.message, 'Unable to update password.'));
        return;
      }
      try {
        const keyRes = await fetch('/api/mvp/workspace/key', { cache: 'no-store' });
        if (keyRes.ok) {
          const data = (await keyRes.json()) as { workspaceId?: string };
          if (data.workspaceId) {
            const localWmk = await getWorkspaceKey(data.workspaceId);
            if (localWmk) {
              const wrapped = await wrapWorkspaceKey(
                localWmk,
                password,
                data.workspaceId,
                'password'
              );
              await fetch('/api/mvp/workspace/key', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(wrapped),
              });
            } else {
              setReWrapNote(
                'Your encrypted key is still protected by your previous password or a paired device.'
              );
            }
          }
        }
      } catch {
        // Non-fatal: /app handles unlock fallback.
      }
      setDone(true);
      window.setTimeout(() => router.replace('/app'), 1400);
    } catch {
      setErrorMsg('Unable to update password. Please request a new reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={loginStyles.page}>
      <div className={callbackStyles.callbackCard}>
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

        {done ? (
          <div className={callbackStyles.centerBlock}>
            <div className={callbackStyles.checkBadge} aria-hidden="true">
              <Check size={28} strokeWidth={2.4} />
            </div>
            <h1 className={loginStyles.title}>Password updated</h1>
            <p className={callbackStyles.subtitle}>Opening your Lyga workspace…</p>
            {reWrapNote ? (
              <p className={callbackStyles.subtitle} style={{ marginTop: 8 }}>
                {reWrapNote}
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <h1 className={loginStyles.title}>Set a new password</h1>
            <form className={loginStyles.form} noValidate onSubmit={(e) => void handleSubmit(e)}>
              <label className={loginStyles.label}>
                New password
                <div className={loginStyles.passwordWrap}>
                  <input
                    ref={passwordRef}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? 'reset-pw-error' : undefined}
                    className={`${loginStyles.input} ${loginStyles.passwordInput} ${fieldErrors.password ? loginStyles.inputError : ''}`}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.currentTarget.value);
                      if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
                    }}
                    required
                  />
                  <button
                    type="button"
                    className={loginStyles.eyeBtn}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {fieldErrors.password ? (
                  <p id="reset-pw-error" className={loginStyles.fieldError} role="alert">
                    {fieldErrors.password}
                  </p>
                ) : (
                  <p className={loginStyles.fieldHint}>{PASSWORD_REQUIREMENTS_HINT}</p>
                )}
              </label>

              <label className={loginStyles.label}>
                Confirm password
                <input
                  ref={confirmRef}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  aria-invalid={Boolean(fieldErrors.confirm)}
                  aria-describedby={fieldErrors.confirm ? 'reset-confirm-error' : undefined}
                  className={`${loginStyles.input} ${fieldErrors.confirm ? loginStyles.inputError : ''}`}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.currentTarget.value);
                    if (fieldErrors.confirm) setFieldErrors((p) => ({ ...p, confirm: undefined }));
                  }}
                  required
                />
                {fieldErrors.confirm && (
                  <p id="reset-confirm-error" className={loginStyles.fieldError} role="alert">
                    {fieldErrors.confirm}
                  </p>
                )}
              </label>

              {errorMsg && (
                <div className={loginStyles.errorBanner} role="alert">
                  <span>{errorMsg}</span>
                  <button
                    type="button"
                    className={loginStyles.bannerClose}
                    aria-label="Dismiss error"
                    onClick={() => setErrorMsg(null)}
                  >
                    <X size={15} />
                  </button>
                </div>
              )}

              <Button type="submit" fullWidth loading={loading} className={loginStyles.primaryBtn}>
                Save new password →
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

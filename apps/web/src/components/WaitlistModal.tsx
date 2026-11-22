'use client';

import { useRef, useState } from 'react';
import { Button, Modal, TextInput } from '@mantine/core';
import { trackEvent, type WaitlistPlan } from '@/lib/analytics';
import { validateWaitlistEmail } from '@/lib/email-validation';
import styles from './WaitlistModal.module.css';

interface WaitlistModalProps {
  opened: boolean;
  plan: WaitlistPlan;
  onClose: () => void;
}

const PHONE_OPTIONS = ['iPhone', 'Android', 'Other'];
const COMPUTER_OPTIONS = ['Windows', 'Mac', 'Linux', 'Other'];

function formatDeviceCombo(phone: string | null, computer: string | null): string | undefined {
  if (phone && computer) return `${phone} + ${computer}`;
  return phone ?? computer ?? undefined;
}

export function WaitlistModal({ opened, plan, onClose }: WaitlistModalProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [computer, setComputer] = useState<string | null>(null);
  const [painNote, setPainNote] = useState('');
  const [savingDone, setSavingDone] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const syncAbortRef = useRef<AbortController | null>(null);

  const handleResetAndClose = () => {
    setError(null);
    setSubmittedEmail(null);
    setPhone(null);
    setComputer(null);
    setPainNote('');
    setSavingDone(false);
    setNoteError(null);
    onClose();
  };

  const handleSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateWaitlistEmail(email);
    if (!validation.valid) {
      setError(validation.error ?? 'Please enter a valid email address.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: validation.normalized, plan }),
      });
      const data = (await res.json()) as { error?: string; entry?: { email: string } };
      if (!res.ok) {
        setError(data.error || 'Please enter a valid email address.');
        return;
      }

      const savedEmail = data.entry?.email ?? email.trim().toLowerCase();
      setSubmittedEmail(savedEmail);
      trackEvent('waitlist_submitted', { plan });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const syncDeviceSelection = async (nextPhone: string | null, nextComputer: string | null) => {
    const combo = formatDeviceCombo(nextPhone, nextComputer);
    if (!combo) return;
    trackEvent('device_combo_selected', { combo });
    if (!submittedEmail) return;

    syncAbortRef.current?.abort();
    const controller = new AbortController();
    syncAbortRef.current = controller;

    await fetch('/api/waitlist', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ email: submittedEmail, deviceCombo: combo, painNote }),
    }).catch(() => undefined);
  };

  const handleDone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittedEmail) {
      handleResetAndClose();
      return;
    }

    const combo = formatDeviceCombo(phone, computer);
    if (!painNote.trim() && !combo) {
      handleResetAndClose();
      return;
    }

    setNoteError(null);
    setSavingDone(true);
    const res = await fetch('/api/waitlist', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: submittedEmail, deviceCombo: combo, painNote }),
    }).catch(() => null);
    setSavingDone(false);

    if (res?.ok) {
      handleResetAndClose();
    } else {
      setNoteError('Could not save note. Please try again.');
    }
  };

  const title = submittedEmail
    ? "You're on the list"
    : plan === 'pro_founder'
      ? 'Reserve your £5/mo Founder Spot'
      : 'Join the Lyga waitlist';

  return (
    <Modal
      opened={opened}
      onClose={handleResetAndClose}
      title={title}
      centered
      transitionProps={{
        transition: 'pop',
        duration: 220,
        timingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {!submittedEmail ? (
        <form className={styles.form} onSubmit={handleSubmitEmail}>
          <p className={styles.note}>
            {plan === 'pro_founder'
              ? 'No card required today. Enter your email to lock in £5/mo when Pro opens.'
              : 'Enter your email and we will send your invite as soon as early access opens.'}
          </p>
          <TextInput
            type="email"
            label="Email address"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.currentTarget.value);
              if (error) setError(null);
            }}
            error={error}
            required
            autoFocus
          />
          <Button type="submit" loading={submitting} fullWidth>
            {plan === 'pro_founder' ? 'Reserve £5/mo Spot' : 'Join Free Waitlist'}
          </Button>
        </form>
      ) : (
        <div className={`${styles.form} ${styles.stepTwoEnter}`}>
          <div className={styles.savedBanner}>
            <div className={styles.savedTitle}>
              <span className={styles.checkBadge} aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none" className={styles.checkSvg}>
                  <path
                    d="M3.5 8.5L6.5 11.5L12.5 4.5"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={styles.checkPath}
                  />
                </svg>
              </span>
              <span>
                Got it, <strong>{submittedEmail}</strong> is saved!
              </span>
            </div>
            <p className={styles.savedSub}>
              Let us know what you use so we can build Lyga around your setup:
            </p>
          </div>

          <div>
            <p className={styles.note} style={{ marginBottom: 8, fontWeight: 600 }}>
              Which phone do you use?
            </p>
            <div className={styles.chips}>
              {PHONE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  aria-pressed={phone === opt}
                  className={`${styles.chip} ${phone === opt ? styles.chipActive : ''}`}
                  onClick={() => {
                    setPhone(opt);
                    void syncDeviceSelection(opt, computer);
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className={styles.note} style={{ marginBottom: 8, fontWeight: 600 }}>
              Which computer do you use?
            </p>
            <div className={styles.chips}>
              {COMPUTER_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  aria-pressed={computer === opt}
                  className={`${styles.chip} ${computer === opt ? styles.chipActive : ''}`}
                  onClick={() => {
                    setComputer(opt);
                    void syncDeviceSelection(phone, opt);
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <form className={styles.form} onSubmit={handleDone}>
            <TextInput
              label="What file was a pain to send recently? (optional)"
              placeholder="e.g. 1.2 GB 4K clip from iPhone to Windows"
              value={painNote}
              onChange={(e) => setPainNote(e.currentTarget.value)}
              error={noteError}
            />
            <Button type="submit" fullWidth loading={savingDone}>
              Done
            </Button>
          </form>
        </div>
      )}
    </Modal>
  );
}

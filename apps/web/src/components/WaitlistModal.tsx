'use client';

import { useState } from 'react';
import { Button, Modal, TextInput } from '@mantine/core';
import { trackEvent, type WaitlistPlan } from '@/lib/analytics';
import styles from './WaitlistModal.module.css';

interface WaitlistModalProps {
  opened: boolean;
  plan: WaitlistPlan;
  onClose: () => void;
}

const DEVICE_COMBOS = [
  'iPhone + Windows',
  'iPhone + Mac',
  'Android + Windows',
  'Other',
];

export function WaitlistModal({ opened, plan, onClose }: WaitlistModalProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [deviceCombo, setDeviceCombo] = useState<string | null>(null);
  const [painNote, setPainNote] = useState('');
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const handleResetAndClose = () => {
    setError(null);
    setSubmittedEmail(null);
    setDeviceCombo(null);
    setPainNote('');
    setFeedbackSaved(false);
    setNoteError(null);
    onClose();
  };

  const handleSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, plan }),
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

  const handleSelectCombo = async (combo: string) => {
    setDeviceCombo(combo);
    trackEvent('device_combo_selected', { combo });
    if (!submittedEmail) return;

    await fetch('/api/waitlist', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: submittedEmail, deviceCombo: combo, painNote }),
    }).catch(() => undefined);
  };

  const handleSavePainNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittedEmail) return;
    setNoteError(null);
    const res = await fetch('/api/waitlist', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: submittedEmail, deviceCombo, painNote }),
    }).catch(() => null);
    if (res?.ok) {
      setFeedbackSaved(true);
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
    <Modal opened={opened} onClose={handleResetAndClose} title={title} centered>
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
            onChange={(e) => setEmail(e.currentTarget.value)}
            error={error}
            required
            autoFocus
          />
          <Button type="submit" loading={submitting} fullWidth>
            {plan === 'pro_founder' ? 'Reserve £5/mo Spot' : 'Join Free Waitlist'}
          </Button>
        </form>
      ) : (
        <div className={styles.form}>
          <p className={styles.note}>
            Saved for <strong>{submittedEmail}</strong>. Quick question to help us prioritize platforms:
          </p>

          <div>
            <p className={styles.note} style={{ marginBottom: 8, fontWeight: 600 }}>
              Which setup do you use?
            </p>
            <div className={styles.chips}>
              {DEVICE_COMBOS.map((combo) => (
                <button
                  key={combo}
                  type="button"
                  aria-pressed={deviceCombo === combo}
                  className={`${styles.chip} ${deviceCombo === combo ? styles.chipActive : ''}`}
                  onClick={() => handleSelectCombo(combo)}
                >
                  {combo}
                </button>
              ))}
            </div>
          </div>

          <form className={styles.form} onSubmit={handleSavePainNote}>
            <TextInput
              label="What was the last file that was annoying to send? (optional)"
              placeholder="e.g. 1.2 GB 4K clip from iPhone to Windows"
              value={painNote}
              onChange={(e) => setPainNote(e.currentTarget.value)}
              error={noteError}
            />
            {feedbackSaved ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <p className={styles.note}>Thanks, noted.</p>
                <Button variant="subtle" size="sm" onClick={handleResetAndClose}>
                  Done
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10 }}>
                <Button type="submit" variant="light" size="sm">
                  Save note
                </Button>
                <Button variant="subtle" size="sm" onClick={handleResetAndClose}>
                  Done
                </Button>
              </div>
            )}
          </form>
        </div>
      )}
    </Modal>
  );
}

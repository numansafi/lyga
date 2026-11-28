'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { detectDeviceName } from './device-label';
import { saveWorkspaceKey } from './key-store';
import { createEphemeralQrKey, decryptWmkFromQr } from './qr-crypto';

export function useQrLoginSession(opts: {
  enabled: boolean;
  onApproved: () => void;
  onError: (msg: string) => void;
}) {
  const { enabled, onApproved, onError } = opts;
  const [qrUrl, setQrUrl] = useState('');
  const [qrExpired, setQrExpired] = useState(false);
  const [qrChallenge, setQrChallenge] = useState<{ id: string; secret: string } | null>(null);
  const qrKeyRef = useRef<string | null>(null);
  const sessionSeqRef = useRef(0);
  const onApprovedRef = useRef(onApproved);
  const onErrorRef = useRef(onError);
  onApprovedRef.current = onApproved;
  onErrorRef.current = onError;

  const startQrSession = useCallback(async () => {
    const seq = ++sessionSeqRef.current;
    try {
      setQrExpired(false);
      const qrKey = createEphemeralQrKey();
      const res = await fetch('/api/mvp/qr-login', { method: 'POST' });
      if (seq !== sessionSeqRef.current) return;
      if (!res.ok) {
        setQrExpired(true);
        onErrorRef.current('Unable to start QR pairing. Refresh to try again.');
        return;
      }
      const data = (await res.json()) as { id: string; secret: string };
      if (seq !== sessionSeqRef.current) return;
      qrKeyRef.current = qrKey;
      setQrChallenge({ id: data.id, secret: data.secret });
      setQrUrl(
        `${window.location.origin}/qr-approve?id=${encodeURIComponent(data.id)}#k=${encodeURIComponent(qrKey)}`
      );
    } catch {
      if (seq !== sessionSeqRef.current) return;
      setQrExpired(true);
      onErrorRef.current('Unable to start QR pairing. Refresh to try again.');
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      void startQrSession();
    }
  }, [enabled, startQrSession]);

  useEffect(() => {
    if (!enabled || !qrChallenge || qrExpired) return;
    let active = true;
    let inFlight = false;

    const pollOnce = async () => {
      if (!active || inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      try {
        const label = encodeURIComponent(detectDeviceName());
        const res = await fetch(
          `/api/mvp/qr-login?id=${encodeURIComponent(qrChallenge.id)}&secret=${encodeURIComponent(qrChallenge.secret)}&label=${label}`,
          { cache: 'no-store' }
        );
        const data = (await res.json().catch(() => null)) as
          | { status: 'pending' | 'expired' }
          | { status: 'approved'; workspaceId: string; encryptedWmk: string }
          | { status: 'error'; error?: string }
          | null;

        if (!active || !data) return;

        if (data.status === 'expired') {
          window.clearInterval(timer);
          void startQrSession();
        } else if (data.status === 'error') {
          window.clearInterval(timer);
          onErrorRef.current(data.error ?? 'Could not pair device.');
          setQrExpired(true);
        } else if (data.status === 'approved' && qrKeyRef.current) {
          window.clearInterval(timer);
          try {
            const wmk = await decryptWmkFromQr(data.encryptedWmk, qrKeyRef.current);
            await saveWorkspaceKey(data.workspaceId, wmk);
            onApprovedRef.current();
          } catch {
            if (!active) return;
            onErrorRef.current('Unable to decrypt workspace key from QR code. Refresh and try again.');
            setQrExpired(true);
          }
        }
      } catch {
        // ignore transient network poll errors
      } finally {
        inFlight = false;
      }
    };

    const timer = window.setInterval(() => {
      void pollOnce();
    }, 2000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void pollOnce();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, qrChallenge, qrExpired, startQrSession]);

  return { qrUrl, qrExpired, startQrSession };
}

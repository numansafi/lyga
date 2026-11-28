const OTP_STORAGE_KEY = 'lyga:login-otp';
const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_COOLDOWN_SECONDS = 30;

export interface StoredOtpState {
  email: string;
  sentAt: number;
}

/** Remember that an OTP was sent so a mobile tab reload (app switch) can resume the code step. */
export function saveOtpState(email: string): void {
  try {
    window.sessionStorage.setItem(
      OTP_STORAGE_KEY,
      JSON.stringify({ email, otpSent: true, sentAt: Date.now() })
    );
  } catch {
    // ignore storage access errors
  }
}

export function clearOtpState(): void {
  try {
    window.sessionStorage.removeItem(OTP_STORAGE_KEY);
  } catch {
    // ignore storage access errors
  }
}

export function loadOtpState(): StoredOtpState | null {
  try {
    const raw = window.sessionStorage.getItem(OTP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string; otpSent?: boolean; sentAt?: number };
    if (
      parsed.otpSent &&
      typeof parsed.email === 'string' &&
      typeof parsed.sentAt === 'number' &&
      Date.now() - parsed.sentAt < OTP_TTL_MS
    ) {
      return { email: parsed.email, sentAt: parsed.sentAt };
    }
    window.sessionStorage.removeItem(OTP_STORAGE_KEY);
  } catch {
    // ignore storage access errors
  }
  return null;
}

/** Seconds left on the resend cooldown for a code sent at `sentAt`. */
export function remainingCooldown(sentAt: number): number {
  return Math.max(0, OTP_COOLDOWN_SECONDS - Math.floor((Date.now() - sentAt) / 1000));
}

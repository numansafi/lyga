import { createHmac } from 'node:crypto';
import { getSupabaseAdmin } from '../supabase-admin.ts';

export const PIN_PEPPER_WINDOW_MS = 15 * 60 * 1000;
export const PIN_PEPPER_UNLOCK_MAX_ATTEMPTS = 5;
export const PIN_PEPPER_SETUP_MAX_ATTEMPTS = 10;

interface AttemptBucket {
  count: number;
  resetAt: number;
}

const globalPepperState = globalThis as typeof globalThis & {
  __lygaPinPepperAttempts?: Map<string, AttemptBucket>;
};

function getAttemptMap(): Map<string, AttemptBucket> {
  if (!globalPepperState.__lygaPinPepperAttempts) {
    globalPepperState.__lygaPinPepperAttempts = new Map();
  }
  return globalPepperState.__lygaPinPepperAttempts;
}

function getPepperSecret(): string {
  const dedicated = process.env.LYGA_SYNC_PIN_PEPPER;
  if (dedicated && dedicated.length >= 16) return dedicated;
  const sessionSecret = process.env.LYGA_SESSION_SECRET;
  if (sessionSecret && sessionSecret.length >= 16) return sessionSecret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('LYGA_SYNC_PIN_PEPPER or LYGA_SESSION_SECRET is required in production.');
  }
  return 'lyga-local-dev-pin-pepper-change-in-prod';
}

/** Derives a non-DB secret pepper bound to workspaceId + client PIN hash. */
export function derivePinPepper(workspaceId: string, pinHash: string): string {
  return createHmac('sha256', getPepperSecret())
    .update(`lyga-sync-pin-v1:${workspaceId}:${pinHash}`)
    .digest('base64url');
}

export async function consumePinPepperAttempt(
  workspaceId: string,
  mode: 'setup' | 'unlock',
  now = Date.now()
): Promise<{ allowed: true; remaining: number } | { allowed: false; retryAfterSec: number }> {
  const key = `${mode}:${workspaceId}`;
  const maxAttempts =
    mode === 'setup' ? PIN_PEPPER_SETUP_MAX_ATTEMPTS : PIN_PEPPER_UNLOCK_MAX_ATTEMPTS;

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase.rpc('consume_sync_pin_attempt', {
      p_bucket_key: key,
      p_max_attempts: maxAttempts,
      p_window_ms: PIN_PEPPER_WINDOW_MS,
    });

    if (error) {
      throw new Error('Sync PIN rate-limiter unavailable.');
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (row && typeof row.allowed === 'boolean') {
      if (!row.allowed) {
        return {
          allowed: false,
          retryAfterSec: Math.max(1, Number(row.retry_after_sec || 60)),
        };
      }
      return {
        allowed: true,
        remaining: Math.max(0, Number(row.remaining ?? 0)),
      };
    }
    throw new Error('Sync PIN rate-limiter returned invalid response.');
  }

  const map = getAttemptMap();
  const existing = map.get(key);
  if (!existing || existing.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + PIN_PEPPER_WINDOW_MS });
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  if (existing.count >= maxAttempts) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, remaining: maxAttempts - existing.count };
}

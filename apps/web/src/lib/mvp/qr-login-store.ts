import { randomBytes } from 'node:crypto';
import { getSupabaseAdmin } from '../supabase-admin.ts';

export interface QrLoginChallenge {
  id: string;
  secret: string;
  expiresAt: number;
  status: 'pending' | 'approved';
  pairCode?: string;
  encryptedWmk?: string;
}

const QR_TTL_MS = 5 * 60 * 1000;

const globalStore = globalThis as typeof globalThis & {
  __lygaQrLoginStore?: Map<string, QrLoginChallenge>;
};

function getStore(): Map<string, QrLoginChallenge> {
  if (!globalStore.__lygaQrLoginStore) {
    globalStore.__lygaQrLoginStore = new Map();
  }
  return globalStore.__lygaQrLoginStore;
}

function pruneExpired(now = Date.now()): void {
  const store = getStore();
  for (const [id, entry] of store.entries()) {
    if (entry.expiresAt <= now) {
      store.delete(id);
    }
  }
}

export async function createQrLoginChallenge(now = Date.now()): Promise<{
  id: string;
  secret: string;
  expiresAt: number;
}> {
  const id = randomBytes(8).toString('hex');
  const secret = randomBytes(16).toString('hex');
  const expiresAt = now + QR_TTL_MS;

  const supabase = getSupabaseAdmin();
  if (supabase) {
    await supabase
      .from('qr_login_challenges')
      .delete()
      .lt('expires_at', new Date(now).toISOString());

    const { error } = await supabase.from('qr_login_challenges').insert({
      id,
      secret,
      status: 'pending',
      expires_at: new Date(expiresAt).toISOString(),
    });
    if (error) {
      throw new Error(`Failed to create QR challenge: ${error.message}`);
    }
    return { id, secret, expiresAt };
  }

  pruneExpired(now);
  getStore().set(id, {
    id,
    secret,
    expiresAt,
    status: 'pending',
  });

  return { id, secret, expiresAt };
}

export async function approveQrLoginChallenge(
  id: string,
  pairCode: string,
  encryptedWmk: string,
  now = Date.now()
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from('qr_login_challenges')
      .update({
        status: 'approved',
        pair_code: pairCode,
        encrypted_wmk: encryptedWmk,
      })
      .eq('id', id)
      .gt('expires_at', new Date(now).toISOString())
      .select('id')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to approve QR challenge: ${error.message}`);
    }
    return Boolean(data);
  }

  pruneExpired(now);
  const entry = getStore().get(id);
  if (!entry || entry.expiresAt <= now) return false;

  entry.status = 'approved';
  entry.pairCode = pairCode;
  entry.encryptedWmk = encryptedWmk;
  return true;
}

export async function pollQrLoginChallenge(
  id: string,
  secret: string,
  now = Date.now()
): Promise<
  | { status: 'expired' }
  | { status: 'pending' }
  | { status: 'approved'; pairCode: string; encryptedWmk: string }
> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data: row, error } = await supabase
      .from('qr_login_challenges')
      .select('id, secret, status, expires_at')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to poll QR challenge: ${error.message}`);
    }
    if (
      !row ||
      row.secret !== secret ||
      new Date(row.expires_at as string).getTime() <= now
    ) {
      return { status: 'expired' };
    }

    if (row.status !== 'approved') {
      return { status: 'pending' };
    }

    // Atomic one-time claim
    const { data: claimed, error: claimError } = await supabase
      .from('qr_login_challenges')
      .delete()
      .eq('id', id)
      .eq('secret', secret)
      .eq('status', 'approved')
      .select('pair_code, encrypted_wmk')
      .maybeSingle();

    if (claimError) {
      throw new Error(`Failed to claim QR challenge: ${claimError.message}`);
    }
    if (!claimed?.pair_code || !claimed?.encrypted_wmk) {
      return { status: 'expired' };
    }

    return {
      status: 'approved',
      pairCode: claimed.pair_code as string,
      encryptedWmk: claimed.encrypted_wmk as string,
    };
  }

  pruneExpired(now);
  const entry = getStore().get(id);
  if (!entry || entry.expiresAt <= now || entry.secret !== secret) {
    return { status: 'expired' };
  }

  if (entry.status !== 'approved' || !entry.pairCode || !entry.encryptedWmk) {
    return { status: 'pending' };
  }

  // One-time claim
  getStore().delete(id);
  return {
    status: 'approved',
    pairCode: entry.pairCode,
    encryptedWmk: entry.encryptedWmk,
  };
}

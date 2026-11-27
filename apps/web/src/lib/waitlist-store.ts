import type { WaitlistPlan } from './analytics';
import { createJsonFileStore } from './local-json-store.ts';
import { getSupabaseAdmin } from './supabase-admin.ts';

export interface WaitlistEntry {
  email: string;
  plan: WaitlistPlan;
  device_combo: string | null;
  pain_note: string | null;
  created_at: string;
  updated_at: string;
}

const localWaitlistStore = createJsonFileStore<WaitlistEntry[]>({
  filename: 'waitlist.json',
  envDirVar: 'LYGA_WAITLIST_DIR',
  defaultValue: () => [],
});

export async function saveWaitlistSignup(
  email: string,
  plan: WaitlistPlan
): Promise<WaitlistEntry> {
  const normalized = email.trim().toLowerCase();
  const now = new Date().toISOString();
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { data, error } = await supabase
      .from('waitlist')
      .upsert(
        { email: normalized, plan, updated_at: now },
        { onConflict: 'email' }
      )
      .select()
      .single();

    if (error) {
      throw new Error(`Supabase waitlist error: ${error.message}`);
    }
    return data as WaitlistEntry;
  }

  return localWaitlistStore.withLock(async () => {
    const entries = await localWaitlistStore.read();
    const existingIdx = entries.findIndex((item) => item.email === normalized);
    const record: WaitlistEntry =
      existingIdx >= 0
        ? { ...entries[existingIdx], plan, updated_at: now }
        : {
            email: normalized,
            plan,
            device_combo: null,
            pain_note: null,
            created_at: now,
            updated_at: now,
          };

    if (existingIdx >= 0) {
      entries[existingIdx] = record;
    } else {
      entries.push(record);
    }
    await localWaitlistStore.write(entries);
    return record;
  });
}

export async function updateWaitlistFeedback(
  email: string,
  deviceCombo?: string | null,
  painNote?: string | null
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const now = new Date().toISOString();
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const patch: { updated_at: string; device_combo?: string | null; pain_note?: string | null } = {
      updated_at: now,
    };
    if (deviceCombo !== undefined) {
      patch.device_combo = deviceCombo;
    }
    if (painNote !== undefined) {
      patch.pain_note = painNote?.trim() || null;
    }

    const { error } = await supabase
      .from('waitlist')
      .update(patch)
      .eq('email', normalized);

    if (error) {
      throw new Error(`Supabase waitlist update error: ${error.message}`);
    }
    return;
  }

  await localWaitlistStore.withLock(async () => {
    const entries = await localWaitlistStore.read();
    const idx = entries.findIndex((item) => item.email === normalized);
    if (idx >= 0) {
      entries[idx] = {
        ...entries[idx],
        device_combo: deviceCombo !== undefined ? deviceCombo : entries[idx].device_combo,
        pain_note: painNote !== undefined ? painNote?.trim() || null : entries[idx].pain_note,
        updated_at: now,
      };
      await localWaitlistStore.write(entries);
    }
  });
}

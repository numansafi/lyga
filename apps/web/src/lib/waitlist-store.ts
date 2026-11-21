import { createClient } from '@supabase/supabase-js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { WaitlistPlan } from './analytics';

export interface WaitlistEntry {
  email: string;
  plan: WaitlistPlan;
  device_combo: string | null;
  pain_note: string | null;
  created_at: string;
  updated_at: string;
}

const DEV_DIR =
  process.env.LYGA_WAITLIST_DIR || path.resolve(process.cwd(), '..', '..', '.lyga-dev-data');
const DEV_FILE = path.join(DEV_DIR, 'waitlist.json');

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    if (process.env.NODE_ENV === 'production' && process.env.LYGA_LOCAL_WAITLIST !== 'true') {
      throw new Error('Supabase environment variables are required in production.');
    }
    return null;
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function readDevEntries(): Promise<WaitlistEntry[]> {
  try {
    const raw = await readFile(DEV_FILE, 'utf8');
    return JSON.parse(raw) as WaitlistEntry[];
  } catch {
    return [];
  }
}

async function writeDevEntries(entries: WaitlistEntry[]): Promise<void> {
  await mkdir(DEV_DIR, { recursive: true });
  await writeFile(DEV_FILE, JSON.stringify(entries, null, 2), 'utf8');
}

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

  const entries = await readDevEntries();
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
  await writeDevEntries(entries);
  return record;
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

  const entries = await readDevEntries();
  const idx = entries.findIndex((item) => item.email === normalized);
  if (idx >= 0) {
    entries[idx] = {
      ...entries[idx],
      device_combo: deviceCombo !== undefined ? deviceCombo : entries[idx].device_combo,
      pain_note: painNote !== undefined ? painNote?.trim() || null : entries[idx].pain_note,
      updated_at: now,
    };
    await writeDevEntries(entries);
  }
}

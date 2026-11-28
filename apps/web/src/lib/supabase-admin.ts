import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    if (process.env.NODE_ENV === 'production' && process.env.LYGA_LOCAL_MODE !== 'true') {
      throw new Error('Supabase environment variables are required in production.');
    }
    return null;
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

import { createClient } from '@supabase/supabase-js';
import { getSupabasePublicConfig } from './config';

export function createSupabaseAdminClient() {
  const { url } = getSupabasePublicConfig();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) throw new Error('Supabase server credentials are not configured.');
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

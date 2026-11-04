import { createClient } from '@supabase/supabase-js';
import { supabaseUrl } from './config';

export function createSupabaseAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!supabaseUrl || !secret) throw new Error('Supabase server credentials are not configured.');
  return createClient(supabaseUrl, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

'use client';

import { createBrowserClient } from '@supabase/ssr';
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from './config';

export function createSupabaseBrowserClient() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Add the project publishable key to .env.local.');
  }

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}

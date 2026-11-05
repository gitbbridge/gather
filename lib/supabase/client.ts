'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabasePublicConfig } from './config';

export function createSupabaseBrowserClient(config: SupabasePublicConfig) {
  if (!config.url || !config.publishableKey) {
    throw new Error('Account access is temporarily unavailable. Please contact Gather support.');
  }

  return createBrowserClient(config.url, config.publishableKey);
}

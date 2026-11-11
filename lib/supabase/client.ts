'use client';

import { createBrowserClient } from '@supabase/ssr';
import { resolveSupabaseBrowserConfig, type SupabaseBrowserConfig } from './config';

export type { SupabaseBrowserConfig } from './config';

export function createSupabaseBrowserClient(config?: SupabaseBrowserConfig) {
  const { url, publishableKey } = resolveSupabaseBrowserConfig(config);
  return createBrowserClient(url, publishableKey);
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSupabaseBrowserConfig } from '../lib/supabase/config.ts';

test('server-provided public Supabase config is preferred by browser auth', () => {
  const config = resolveSupabaseBrowserConfig({
    url: 'https://sandbox-project.supabase.co',
    publishableKey: 'sb_publishable_browser_safe',
  });
  assert.equal(config.url, 'https://sandbox-project.supabase.co');
  assert.equal(config.publishableKey, 'sb_publishable_browser_safe');
});

test('browser auth rejects missing or placeholder public configuration', () => {
  assert.throws(
    () => resolveSupabaseBrowserConfig({ url: '', publishableKey: '' }),
    /Supabase is not configured/,
  );
  assert.throws(
    () => resolveSupabaseBrowserConfig({
      url: 'https://example.supabase.co',
      publishableKey: 'your_publishable_key',
    }),
    /Supabase is not configured/,
  );
});

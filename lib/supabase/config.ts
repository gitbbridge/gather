export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

/**
 * Read public Supabase settings at request time. Sites runtime variables are
 * available to the Worker, while NEXT_PUBLIC_* values may be compiled out of
 * browser bundles before a deployment receives its environment settings.
 */
export function getSupabasePublicConfig(): SupabasePublicConfig {
  return {
    url: (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
    publishableKey: (
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      ''
    ).trim(),
  };
}

export function isSupabaseConfigured(config = getSupabasePublicConfig()) {
  return Boolean(
    config.url &&
    config.publishableKey &&
    !config.publishableKey.includes('your_publishable_key'),
  );
}

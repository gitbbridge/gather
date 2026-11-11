export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabasePublishableKey &&
  !supabasePublishableKey.includes('your_publishable_key'),
);

export type SupabaseBrowserConfig = {
  url: string;
  publishableKey: string;
};

export function resolveSupabaseBrowserConfig(config?: SupabaseBrowserConfig) {
  const url = config?.url || supabaseUrl;
  const publishableKey = config?.publishableKey || supabasePublishableKey;
  if (!url || !publishableKey || publishableKey.includes('your_publishable_key')) {
    throw new Error('Supabase is not configured. Add the project publishable key to .env.local.');
  }

  return { url, publishableKey };
}

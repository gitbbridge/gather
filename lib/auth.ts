import { redirect } from 'next/navigation';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type AppUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
  provider: 'supabase' | 'chatgpt';
};

export async function getAppUser(): Promise<AppUser | null> {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user?.email) {
      const fullName = typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name
        : null;
      return {
        userId: user.id,
        email: user.email,
        fullName,
        displayName: fullName || user.email,
        provider: 'supabase',
      };
    }
    return null;
  }

  const chatGPTUser = await getChatGPTUser();
  return chatGPTUser ? { ...chatGPTUser, provider: 'chatgpt' } : null;
}

export async function requireAppUser(returnTo: string): Promise<AppUser> {
  const user = await getAppUser();
  if (user) return user;
  redirect(signInPath(returnTo));
}

export function signInPath(returnTo: string): string {
  return `/auth?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`;
}

export function signOutPath(returnTo = '/'): string {
  return `/auth/signout?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`;
}

export function safeReturnPath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  try {
    const url = new URL(value, 'https://app.local');
    if (url.origin !== 'https://app.local') return '/';
    if (url.pathname.startsWith('/auth') && url.pathname !== '/auth/update-password') return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}

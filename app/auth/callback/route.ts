import { NextResponse } from 'next/server';
import { safeReturnPath } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const returnTo = safeReturnPath(url.searchParams.get('return_to') || '/');
  const callbackError = url.searchParams.get('error');
  if (callbackError) {
    const reset = returnTo === '/auth/update-password';
    return NextResponse.redirect(new URL(`/auth?mode=${reset ? 'forgot' : 'signin'}&return_to=${encodeURIComponent(reset ? '/admin' : returnTo)}&error=${reset ? 'expired_reset' : 'callback'}`, url.origin));
  }
  const supabase = await createSupabaseServerClient();

  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(returnTo, url.origin));
  }

  const reset = returnTo === '/auth/update-password';
  return NextResponse.redirect(new URL(`/auth?mode=${reset ? 'forgot' : 'signin'}&return_to=${encodeURIComponent(reset ? '/admin' : returnTo)}&error=${reset ? 'expired_reset' : 'callback'}`, url.origin));
}

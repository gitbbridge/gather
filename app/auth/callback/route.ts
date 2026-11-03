import { NextResponse } from 'next/server';
import { safeReturnPath } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const returnTo = safeReturnPath(url.searchParams.get('return_to') || '/');
  const supabase = await createSupabaseServerClient();

  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(returnTo, url.origin));
  }

  return NextResponse.redirect(new URL(`/auth?return_to=${encodeURIComponent(returnTo)}&error=callback`, url.origin));
}

import { NextResponse } from 'next/server';
import { safeReturnPath } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = safeReturnPath(url.searchParams.get('return_to') || '/');
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(new URL(`/signout-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`, url.origin));
  }
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL(returnTo, url.origin));
}

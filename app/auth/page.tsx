import { Leaf } from 'lucide-react';
import { redirect } from 'next/navigation';
import { AuthForm } from './auth-form';
import { getAppUser, safeReturnPath } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in | Gather' };

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string; mode?: string; error?: string }>;
}) {
  const { return_to: requestedReturn = '/', mode, error } = await searchParams;
  const returnTo = safeReturnPath(requestedReturn);
  if (await getAppUser()) redirect(returnTo);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f7f5] px-5 py-10">
      <div className="w-full max-w-md">
        <a href="/" className="mb-8 flex items-center justify-center gap-2 text-2xl font-semibold text-[#175b47]">
          <Leaf size={22} /> gather<span className="text-[#78a68b]">.</span>
        </a>
        <section className="rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#175b47]">Welcome to Gather</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in to continue</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Create auctions, manage your nonprofit page, and keep your bidder activity in one secure account.
          </p>
          {isSupabaseConfigured ? (
            <AuthForm returnTo={returnTo} initialMode={mode === 'forgot' ? 'forgot' : mode === 'signup' ? 'signup' : 'signin'} initialMessage={error === 'expired_reset' ? 'That password-reset link is invalid or has expired. Request a new one below.' : error === 'callback' ? 'We could not complete that secure sign-in link. Please try again.' : ''} />
          ) : (
            <div className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              Supabase is connected to the project URL, but the publishable key is still needed. Add
              <code className="mx-1 rounded bg-white/70 px-1.5 py-0.5">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>
              to <code className="rounded bg-white/70 px-1.5 py-0.5">.env.local</code>.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

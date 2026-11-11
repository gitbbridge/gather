import { Leaf } from 'lucide-react';
import { requireAppUser } from '@/lib/auth';
import UpdatePasswordForm from './update-password-form';
import { supabasePublishableKey, supabaseUrl } from '@/lib/supabase/config';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Choose a new password | Gather' };

export default async function UpdatePasswordPage() {
  await requireAppUser('/auth/update-password');
  return <main className="grid min-h-screen place-items-center bg-[#f4f7f5] px-5 py-10"><div className="w-full max-w-md">
    <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-2xl font-semibold text-[#175b47]"><Leaf size={22}/>gather<span className="text-[#78a68b]">.</span></Link>
    <section className="rounded-2xl border bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#175b47]">Secure your account</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Choose a new password</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Use at least eight characters and choose something you don’t use on another website.</p><UpdatePasswordForm supabaseConfig={{ url: supabaseUrl, publishableKey: supabasePublishableKey }}/></section>
  </div></main>;
}

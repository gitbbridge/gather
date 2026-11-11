import { Leaf, LockKeyhole } from 'lucide-react';
import Link from 'next/link';
import { requireAppUser } from '@/lib/auth';
import { isPlatformAdmin } from '@/lib/platform-admin';
import { platformSecurityAccess } from '@/lib/security/privileged-access';
import EmailTemplatesClient from './templates-client';
import ResendTestButton from './resend-test-button';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Email templates | Gather' };

export default async function EmailTemplatesPage() {
  const user = await requireAppUser('/admin/email-templates');
  if (!isPlatformAdmin(user)) {
    return <main className="min-h-screen bg-[#f8faf9] px-5 py-12"><div className="mx-auto max-w-xl"><Link href="/" className="flex items-center gap-2 text-2xl font-semibold text-[#175b47]"><Leaf size={22}/>gather<span className="text-[#78a68b]">.</span></Link><section className="mt-12 rounded-2xl border bg-white p-8 shadow-sm"><LockKeyhole className="text-[#175b47]"/><h1 className="mt-5 text-3xl font-semibold">Platform admin access required</h1><p className="mt-3 text-muted-foreground">Email templates control security and transactional messages across every organization.</p><Link href="/admin" className="mt-6 inline-flex text-sm font-semibold text-[#175b47]">Return to dashboard →</Link></section></div></main>;
  }
  const security = await platformSecurityAccess();
  if (!security.allowed) {
    return <main className="min-h-screen bg-[#f8faf9] px-5 py-12"><div className="mx-auto max-w-xl"><Link href="/" className="flex items-center gap-2 text-2xl font-semibold text-[#175b47]"><Leaf size={22}/>gather<span className="text-[#78a68b]">.</span></Link><section className="mt-12 rounded-2xl border bg-white p-8 shadow-sm"><LockKeyhole className="text-[#175b47]"/><h1 className="mt-5 text-3xl font-semibold">Authenticator verification required</h1><p className="mt-3 text-muted-foreground">Platform-wide email templates require a verified multi-factor session.</p><Link href="/admin/security" className="mt-6 inline-flex text-sm font-semibold text-[#175b47]">Open Security Center →</Link></section></div></main>;
  }

  return <>
    <div className="fixed right-5 top-20 z-50 flex items-center gap-2">
      <ResendTestButton/>
      <a href="/admin/email-templates/supabase-config" className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-[#175b47] shadow-sm">Download Supabase JSON</a>
    </div>
    <EmailTemplatesClient/>
  </>;
}

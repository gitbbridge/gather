import {Leaf,LockKeyhole} from 'lucide-react';
import {requireAppUser} from '@/lib/auth';
import {isPlatformAdmin} from '@/lib/platform-admin';
import EmailTemplatesClient from './templates-client';

export const dynamic='force-dynamic';
export const metadata={title:'Email templates | Gather'};
export default async function EmailTemplatesPage(){const user=await requireAppUser('/admin/email-templates');if(!isPlatformAdmin(user))return <main className="min-h-screen bg-[#f8faf9] px-5 py-12"><div className="mx-auto max-w-xl"><a href="/" className="flex items-center gap-2 text-2xl font-semibold text-[#175b47]"><Leaf size={22}/>gather<span className="text-[#78a68b]">.</span></a><section className="mt-12 rounded-2xl border bg-white p-8 shadow-sm"><LockKeyhole className="text-[#175b47]"/><h1 className="mt-5 text-3xl font-semibold">Platform admin access required</h1><p className="mt-3 text-muted-foreground">Email templates control security and transactional messages across every organization.</p><a href="/admin" className="mt-6 inline-flex text-sm font-semibold text-[#175b47]">Return to dashboard →</a></section></div></main>;return <><a href="/admin/email-templates/supabase-config" className="fixed right-5 top-20 z-50 rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-[#175b47] shadow-sm">Download Supabase JSON</a><EmailTemplatesClient/></>}

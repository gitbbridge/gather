import { requireAppUser, signOutPath } from '@/lib/auth';
import AdminClient from './admin-client';
import { Toaster } from 'sonner';
export const dynamic = 'force-dynamic';
export default async function AdminPage() { await requireAppUser('/admin'); return <main className="min-h-screen bg-[#f8faf9] px-4 py-5 pb-24 sm:px-5 lg:p-10"><div className="mx-auto max-w-7xl"><div className="mb-7 flex items-center justify-between"><a href="/" className="text-2xl font-semibold tracking-tight text-[#175b47]">gather<span className="text-[#78a68b]">.</span></a><div className="flex items-center gap-4"><a href="/" className="min-h-11 content-center text-sm font-medium text-muted-foreground hover:text-foreground">Back to auction</a><a href={signOutPath('/')} className="min-h-11 content-center text-sm font-medium text-muted-foreground hover:text-foreground">Sign out</a></div></div><AdminClient /></div><Toaster richColors /></main>; }

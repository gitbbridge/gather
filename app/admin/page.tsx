import { requireChatGPTUser } from '@/app/chatgpt-auth';
import AdminClient from './admin-client';
import { Toaster } from 'sonner';
export const dynamic = 'force-dynamic';
export default async function AdminPage() { await requireChatGPTUser('/admin'); return <main className="min-h-screen bg-[#f8faf9] p-5 lg:p-10"><div className="mx-auto max-w-7xl"><div className="mb-8 flex items-center justify-between"><a href="/" className="text-2xl font-semibold tracking-tight text-[#175b47]">gather<span className="text-[#78a68b]">.</span></a><a href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">Back to auction</a></div><AdminClient /></div><Toaster richColors /></main>; }

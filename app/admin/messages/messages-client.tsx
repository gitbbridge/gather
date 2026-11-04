'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Bot, CheckCircle2, Inbox, Leaf, LoaderCircle, Send, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toaster, toast } from 'sonner';
import Link from 'next/link';

type Message = { id: string; sender: 'user' | 'assistant' | 'organizer'; body: string; created_at: number };
type Conversation = { id:string;subject:string;status:string;auctionName:string;nonprofit_name:string;user_email:string|null;created_at:number;updated_at:number;messages:Message[] };

export default function MessagesClient() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/messages');
      const result = await response.json() as { conversations?: Conversation[]; error?: string };
      if (!response.ok) throw Error(result.error || 'Unable to load messages.');
      setConversations(result.conversations || []);
      setSelectedId(current => current || result.conversations?.[0]?.id || '');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to load messages.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const selected = conversations.find(item => item.id === selectedId) || null;

  const reply = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const body = String(new FormData(form).get('body') || '').trim();
    if (!body) return;
    setSending(true);
    try {
      const response = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: selected.id, body, resolve: true }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw Error(result.error || 'Unable to send reply.');
      form.reset(); toast.success('Reply saved'); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to send reply.'); }
    finally { setSending(false); }
  };

  return <main className="min-h-screen bg-[#f8faf9] px-4 py-6 sm:px-8"><Toaster richColors/><div className="mx-auto max-w-7xl">
    <header className="flex flex-wrap items-center justify-between gap-4"><Link href="/admin" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground"><ArrowLeft size={16}/>Auction dashboard</Link><Link href="/" className="flex items-center gap-2 text-2xl font-semibold text-[#175b47]"><Leaf size={21}/>gather<span className="text-[#78a68b]">.</span></Link></header>
    <div className="mt-8"><p className="text-xs font-semibold uppercase tracking-[.17em] text-[#648371]">Organizer inbox</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Gather Messages</h1><p className="mt-3 max-w-2xl leading-7 text-muted-foreground">Questions the Gather Assistant could not answer reliably appear here with their auction context.</p></div>
    {loading ? <div className="mt-8 rounded-2xl border bg-white p-10 text-muted-foreground"><LoaderCircle className="mb-3 animate-spin"/>Loading questions…</div> : conversations.length === 0 ? <div className="mt-8 rounded-2xl border bg-white p-12 text-center"><Inbox className="mx-auto text-[#648371]" size={34}/><h2 className="mt-4 text-lg font-semibold">No organizer questions yet</h2><p className="mt-2 text-sm text-muted-foreground">Escalated bidder questions will appear here.</p></div> : <div className="mt-8 grid min-h-[36rem] overflow-hidden rounded-2xl border bg-white shadow-sm lg:grid-cols-[22rem_1fr]">
      <aside className="border-b lg:border-b-0 lg:border-r"><div className="border-b px-5 py-4 text-sm font-semibold">Questions <span className="ml-1 text-muted-foreground">{conversations.filter(item => item.status === 'escalated').length} open</span></div><div className="max-h-[30rem] overflow-y-auto lg:max-h-[42rem]">{conversations.map(item => <button type="button" key={item.id} onClick={() => setSelectedId(item.id)} className={`block w-full border-b px-5 py-4 text-left transition ${selectedId === item.id ? 'bg-[#eef4f0]' : 'hover:bg-[#f8faf9]'}`}><div className="flex items-center justify-between gap-3"><span className="truncate text-sm font-semibold">{item.auctionName}</span><span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${item.status === 'resolved' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-800'}`}>{item.status}</span></div><p className="mt-2 line-clamp-2 text-sm text-[#51675d]">{item.subject}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(item.updated_at).toLocaleString()}</p></button>)}</div></aside>
      {selected && <section className="flex min-h-0 flex-col"><header className="border-b px-5 py-4 sm:px-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#648371]">{selected.nonprofit_name} · {selected.auctionName}</p><h2 className="mt-1 text-lg font-semibold">{selected.subject}</h2><p className="mt-1 text-xs text-muted-foreground">{selected.user_email || 'Signed-in bidder'}</p></div>{selected.status === 'resolved' && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"><CheckCircle2 size={14}/>Replied</span>}</div></header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#fbfcfb] p-5 sm:p-7">{selected.messages.map(message => <div key={message.id} className={`flex ${message.sender === 'organizer' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.sender === 'organizer' ? 'rounded-br-md bg-[#175b47] text-white' : 'rounded-bl-md border bg-white'}`}><p className={`mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${message.sender === 'organizer' ? 'text-[#cfe2d7]' : 'text-[#648371]'}`}>{message.sender === 'assistant' ? <Bot size={12}/> : <UserRound size={12}/>} {message.sender === 'assistant' ? 'Gather Assistant' : message.sender === 'organizer' ? 'Organizer' : 'Bidder'}</p><p className="whitespace-pre-wrap">{message.body}</p></div></div>)}</div>
        <form onSubmit={reply} className="border-t bg-white p-4 sm:p-5"><label className="text-sm font-medium" htmlFor="organizer-reply">Reply to the bidder</label><div className="mt-2 flex items-end gap-2"><textarea id="organizer-reply" name="body" required maxLength={2000} rows={2} className="min-h-20 flex-1 resize-none rounded-xl border p-3 text-sm outline-none focus:ring-2 focus:ring-[#175b47]/25" placeholder="Write a clear answer…"/><Button disabled={sending} className="h-11"><Send size={16}/>{sending ? 'Sending…' : 'Send reply'}</Button></div><p className="mt-2 text-xs text-muted-foreground">Sending marks the question resolved. The bidder will see your reply in their Gather Assistant conversation.</p></form>
      </section>}
    </div>}
  </div></main>;
}

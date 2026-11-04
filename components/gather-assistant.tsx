'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, ChevronDown, LoaderCircle, MessageCircle, Send, Sparkles, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Audience = 'bidder' | 'organizer';
type Surface = 'onboarding' | 'auction' | 'item' | 'my-wins' | 'admin' | 'travel';
type ChatMessage = { sender: 'user' | 'assistant' | 'organizer'; body: string; needsEscalation?: boolean };

const bidderSuggestions = ['How do I place a bid?', 'When does this auction end?', 'What happens if I win?', 'How do platform fees work?'];
const organizerSuggestions = ['Help me write my auction description', 'How do I add items?', 'Explain the 5% fee options', 'What should I check before launch?'];

export function GatherAssistant({
  audience,
  surface,
  auctionId,
  itemId,
  onboardingStep,
  welcome = false,
}: {
  audience: Audience;
  surface: Surface;
  auctionId?: string;
  itemId?: string;
  onboardingStep?: number;
  welcome?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [welcomed, setWelcomed] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [anonymousId, setAnonymousId] = useState('');
  const [status, setStatus] = useState('active');
  const [enabled, setEnabled] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const contextKey = useMemo(() => ['gather-assistant', audience, surface, auctionId || 'general', itemId || 'none'].join(':'), [audience, surface, auctionId, itemId]);
  const greeting = audience === 'organizer'
    ? "Hi! I'm the Gather Assistant, an AI assistant. I can help you build and manage your auction, understand setup, bidding, payments, and fulfillment."
    : "Hi! I'm the Gather Assistant, an AI assistant. I can help with auction items, bidding, payments, and event information.";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let anonymous = window.localStorage.getItem('gather-assistant-anonymous-id');
      if (!anonymous) { anonymous = crypto.randomUUID(); window.localStorage.setItem('gather-assistant-anonymous-id', anonymous); }
      setAnonymousId(anonymous);
      setWelcomed(window.localStorage.getItem('gather-assistant-welcomed') === 'yes');
      setConversationId(window.localStorage.getItem(contextKey) || '');
      const query = new URLSearchParams({ anonymousId: anonymous });
      fetch(`/api/assistant?${query}`).then(async response => {
        const result = await response.json() as { enabled?: boolean };
        setEnabled(result.enabled === true);
      }).catch(() => setEnabled(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [contextKey]);

  useEffect(() => {
    if (!conversationId || !anonymousId) return;
    const query = new URLSearchParams({ conversationId, anonymousId });
    fetch(`/api/assistant?${query}`).then(async response => {
      if (!response.ok) return;
      const result = await response.json() as { enabled?:boolean;status?: string; messages?: {sender:string;body:string;needs_escalation?:number}[] };
      setEnabled(result.enabled === true);
      if (result.status) setStatus(result.status);
      if (result.messages?.length) setMessages(result.messages.map(message => ({ sender: message.sender as ChatMessage['sender'], body: message.body, needsEscalation: message.needs_escalation === 1 })));
    }).catch(() => undefined);
  }, [conversationId, anonymousId]);

  useEffect(() => { viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' }); }, [messages, busy]);

  const introduce = () => {
    window.localStorage.setItem('gather-assistant-welcomed', 'yes');
    setWelcomed(true);
    setOpen(true);
  };

  const send = async (question = value) => {
    const message = question.trim();
    if (!message || busy || !anonymousId) return;
    setMessages(current => [...current, { sender: 'user', body: message }]);
    setValue(''); setError(''); setBusy(true);
    try {
      const response = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, conversationId: conversationId || undefined, anonymousId, audience, surface, auctionId, itemId, onboardingStep }) });
      const result = await response.json() as { conversationId?:string;answer?:string;needsEscalation?:boolean;error?:string;signIn?:string };
      if (!response.ok) {
        if (result.signIn) { setError(result.error || 'Sign in to continue.'); return; }
        throw Error(result.error || 'Unable to reach the assistant.');
      }
      if (result.conversationId && !conversationId) {
        setConversationId(result.conversationId);
        window.localStorage.setItem(contextKey, result.conversationId);
      }
      setMessages(current => [...current, { sender: 'assistant', body: result.answer || 'I could not prepare a reliable answer.', needsEscalation: result.needsEscalation }]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The assistant is temporarily unavailable.'); }
    finally { setBusy(false); }
  };

  const escalate = async () => {
    if (!conversationId || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/assistant/escalate?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId }) });
      const result = await response.json() as { error?:string;signIn?:string };
      if (!response.ok) {
        if (result.signIn) { window.location.assign(result.signIn); return; }
        throw Error(result.error || 'Unable to send this question.');
      }
      setStatus('escalated');
      setMessages(current => [...current, { sender: 'assistant', body: "I've sent your question to the auction organizer. You'll see their response here when it is available." }]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to send this question.'); }
    finally { setBusy(false); }
  };

  const last = messages[messages.length - 1];
  const suggestions = audience === 'organizer' ? organizerSuggestions : bidderSuggestions;

  if (!enabled) return null;

  return <>
    {welcome && !welcomed && <section className="mt-7 rounded-2xl border border-[#cfe0d6] bg-[#f1f7f3] p-5 sm:p-6" aria-label="Meet your Gather Assistant">
      <div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#175b47] text-white"><Sparkles size={20}/></span><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#648371]">Your AI Auction Assistant</p><h2 className="mt-2 text-xl font-semibold">Welcome to Gather!</h2><p className="mt-2 text-sm leading-6 text-[#5d7067]">I&apos;ll be here throughout setup to help write item descriptions, shape your auction page, choose travel experiences, and explain each decision. You can also complete every step on your own.</p><Button type="button" variant="outline" className="mt-4 bg-white" onClick={introduce}><MessageCircle size={16}/>Ask me anything</Button></div></div>
    </section>}

    {!open && <button type="button" onClick={() => setOpen(true)} className="fixed bottom-5 right-4 z-50 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#175b47] px-4 font-semibold text-white shadow-[0_12px_32px_rgba(23,76,59,.3)] transition hover:bg-[#104735] sm:right-6" aria-label="Open Gather Assistant"><Sparkles size={18}/><span className="hidden sm:inline">Ask Gather</span></button>}
    {open && <section className="fixed inset-x-3 bottom-3 z-50 flex max-h-[min(42rem,calc(100vh-1.5rem))] flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-6 sm:h-[38rem] sm:w-[24rem]" role="dialog" aria-label="Gather Assistant">
      <header className="flex items-center justify-between border-b bg-[#f3f7f4] px-4 py-3"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-[#175b47] text-white"><Bot size={18}/></span><div><p className="font-semibold">Gather Assistant</p><p className="text-[11px] text-muted-foreground">AI auction support</p></div></div><button type="button" onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-full hover:bg-white" aria-label="Close assistant"><ChevronDown size={19}/></button></header>
      <div ref={viewport} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
        <ChatBubble sender="assistant" body={greeting}/>
        {messages.map((message, index) => <ChatBubble key={`${message.sender}-${index}`} {...message}/>)}
        {busy && <div className="flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle size={15} className="animate-spin"/>Gather Assistant is checking verified information…</div>}
        {last?.needsEscalation && status === 'active' && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><p>This needs the auction organizer&apos;s confirmation.</p><Button size="sm" variant="outline" className="mt-3 bg-white" onClick={escalate} disabled={busy}><UserRound size={15}/>Send to organizer</Button></div>}
        {status === 'escalated' && <p className="rounded-lg bg-[#eef4f0] p-3 text-xs text-[#315b49]">Organizer question sent. Return here for the reply.</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {messages.length === 0 && <div className="flex flex-wrap gap-2">{suggestions.map(suggestion => <button type="button" key={suggestion} onClick={() => void send(suggestion)} className="rounded-full border px-3 py-2 text-left text-xs text-[#315b49] hover:border-[#8fb19f] hover:bg-[#f3f7f4]">{suggestion}</button>)}</div>}
      </div>
      <form className="border-t p-3" onSubmit={event => { event.preventDefault(); void send(); }}><label className="sr-only" htmlFor={`assistant-input-${surface}`}>Ask Gather Assistant</label><div className="flex items-end gap-2 rounded-xl border bg-white p-2 focus-within:ring-2 focus-within:ring-[#175b47]/25"><textarea id={`assistant-input-${surface}`} value={value} onChange={event => setValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} maxLength={2000} rows={1} placeholder="Ask about this auction…" className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"/><button type="submit" disabled={!value.trim() || busy} className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#175b47] text-white disabled:opacity-40" aria-label="Send question"><Send size={16}/></button></div><p className="mt-2 px-1 text-[10px] leading-4 text-muted-foreground">AI can make mistakes. Verified auction terms and secure Gather workflows control.</p></form>
    </section>}
  </>;
}

function ChatBubble({ sender, body }: ChatMessage) {
  const mine = sender === 'user';
  return <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${mine ? 'rounded-br-md bg-[#175b47] text-white' : sender === 'organizer' ? 'rounded-bl-md border border-[#bcd5c6] bg-[#edf5f0]' : 'rounded-bl-md bg-[#f2f4f3] text-[#2b4037]'}`}>
    {sender === 'organizer' && <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#4c7663]">Auction organizer</p>}{body}
  </div></div>;
}

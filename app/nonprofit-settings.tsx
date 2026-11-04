'use client';

import { useState } from 'react';
import { ArrowRight, Check, Copy, ExternalLink, Globe, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { NonprofitPublic } from '@/lib/nonprofits';

export function NonprofitSettings({ nonprofit, auctionId, owner, onSaved }: { nonprofit: NonprofitPublic | null; auctionId?: string; owner: boolean; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  async function save(values: Record<string, unknown>) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/nonprofit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw Error(result.error);
      onSaved();
      setMessage('Page basics saved.');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="max-w-4xl">
    <p className="eyebrow mb-2 text-muted-foreground">YOUR NONPROFIT, YOUR HOME</p>
    <h1 className="text-3xl font-semibold tracking-tight">Nonprofit auction page</h1>
    <p className="mb-7 mt-2 max-w-2xl text-muted-foreground">One branded link for your mission and every auction. Supporters can browse freely, then register when they are ready to bid.</p>

    {!nonprofit ? <div className="panel">
      <Globe className="mb-4 text-primary"/>
      <h2 className="mb-2 text-xl font-semibold">Create your nonprofit page</h2>
      <p className="mb-5 text-muted-foreground">We’ll use this auction to create a permanent nonprofit page and shareable link.</p>
      <Button disabled={!owner || busy || !auctionId} onClick={() => save({ action: 'setup', auctionId })}>{busy ? 'Creating…' : 'Create nonprofit page'}</Button>
      {!owner && <p className="mt-3 text-sm">Create your own auction first to get a nonprofit page.</p>}
    </div> : <>
      <div className="panel mb-6">
        <div className="mb-3 flex items-center gap-2 font-semibold"><Globe size={18}/>Your shareable auction-page link</div>
        <code className="mb-4 block break-all rounded-lg bg-muted p-3 text-sm">{typeof window !== 'undefined' ? window.location.origin : ''}/n/{nonprofit.slug}</code>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/n/${nonprofit.slug}`); setCopied(true); } catch { setMessage('Select and copy the link above.'); } }}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? 'Copied' : 'Copy link'}</Button>
          <Button variant="outline" asChild><a href={`/n/${nonprofit.slug}`} target="_blank" rel="noreferrer">View live page <ExternalLink size={16}/></a></Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">This link stays the same. Every auction connected to this nonprofit can appear on the page.</p>
      </div>

      <div className="panel mb-6 border-[#cfe0d5] bg-[#f3f8f5]">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#dfece4] text-[#175b47]"><Palette size={20}/></span><div><h2 className="font-semibold">Design the complete auction page</h2><p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">Add your logo, choose colors and fonts, edit the story, feature auctions or items, and preview desktop and mobile layouts.</p></div></div>
          <Button asChild className="shrink-0"><a href={`/homepage?nonprofit=${encodeURIComponent(nonprofit.id)}`}>Open page builder <ArrowRight size={16}/></a></Button>
        </div>
      </div>

      <form key={nonprofit.id} className="panel space-y-5" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void save({ action: 'branding', id: nonprofit.id, name: form.get('name'), headline: form.get('headline'), mission: form.get('mission'), accent: form.get('accent') }); }}>
        <div><h2 className="text-xl font-semibold">Page basics</h2><p className="mt-1 text-sm text-muted-foreground">These details provide the starting content for your auction page.</p></div>
        <label className="block text-sm font-medium">Nonprofit name<Input className="mt-2" name="name" defaultValue={nonprofit.name} minLength={2} maxLength={100} required/></label>
        <label className="block text-sm font-medium">Welcome headline<Input className="mt-2" name="headline" defaultValue={nonprofit.headline} minLength={5} maxLength={140} required/></label>
        <label className="block text-sm font-medium">Your mission<textarea name="mission" defaultValue={nonprofit.mission} minLength={20} maxLength={2000} required rows={5} className="mt-2 w-full rounded-lg border p-3 text-base font-normal"/></label>
        <label className="block text-sm font-medium">Starting brand color<Select name="accent" defaultValue={nonprofit.accent}><SelectTrigger className="mt-2 w-full"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="#175b47">Forest green</SelectItem><SelectItem value="#264d7e">Ocean blue</SelectItem><SelectItem value="#763e62">Plum</SelectItem><SelectItem value="#8b431e">Terracotta</SelectItem></SelectContent></Select></label>
        <Button disabled={!owner || busy}>{busy ? 'Saving…' : 'Save page basics'}</Button>
      </form>
    </>}
    {message && <p role="status" className="mt-4 text-sm">{message}</p>}
  </div>;
}

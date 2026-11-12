'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, CalendarDays, Check, CheckCircle2, CircleHelp, Globe2, Leaf, MapPin, Plane, Plus, Radio, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { withAuthenticatedEmail } from '@/lib/onboarding-draft';
import Link from 'next/link';

const steps = ['Organization', 'Event Details', 'Add Items', 'Payment & Fees', 'Review & Launch'];
const storageKey = 'gather-onboarding-draft-v1';

type Item = { id: string; title: string; value: string; source?: 'custom' | 'give-holidays'; packageCode?: string };
type EventType = 'online_silent' | 'live' | 'hybrid';
type TravelPackage = { id: string; destination: string; region: string; code: string; tone: string };
const travelPackages: TravelPackage[] = [
  { id: 'cabo-san-lucas', destination: 'Cabo San Lucas', region: 'Mexico', code: 'CABO', tone: 'linear-gradient(135deg, #d68054 0%, #f2c37d 100%)' },
  { id: 'costa-rica', destination: 'Costa Rica', region: 'Central America', code: 'CR', tone: 'linear-gradient(135deg, #2e7259 0%, #8dbb82 100%)' },
  { id: 'tuscany', destination: 'Tuscany', region: 'Italy', code: 'TUS', tone: 'linear-gradient(135deg, #8c653f 0%, #d7b873 100%)' },
  { id: 'paris', destination: 'Paris', region: 'France', code: 'PAR', tone: 'linear-gradient(135deg, #5e607b 0%, #b4a7ba 100%)' },
  { id: 'maui', destination: 'Maui', region: 'Hawaii', code: 'MAUI', tone: 'linear-gradient(135deg, #197e85 0%, #81c9b7 100%)' },
  { id: 'new-york-city', destination: 'New York City', region: 'New York', code: 'NYC', tone: 'linear-gradient(135deg, #394957 0%, #8797a1 100%)' },
];
type Draft = {
  organization: string; nonprofitSlug: string; contactName: string; email: string; auctionName: string;
  eventType: EventType; description: string; timezone: string;
  auctionDate: string; closeDate: string; eventDate: string; eventTime: string;
  venueName: string; venueAddress: string; planningNotes: string;
  plannedLiveAuction: boolean; plannedSilentAuction: boolean; plannedDonationAppeal: boolean; items: Item[];
  commissionPayer: 'organizer' | 'split' | 'bidder'; organizerShare: string;
};
const emptyDraft: Draft = {
  organization: '', nonprofitSlug: '', contactName: '', email: '', auctionName: '', eventType: 'online_silent', description: '', timezone: 'America/Denver', auctionDate: '', closeDate: '', eventDate: '', eventTime: '', venueName: '', venueAddress: '', planningNotes: '', plannedLiveAuction: true, plannedSilentAuction: false, plannedDonationAppeal: true,
  items: [], commissionPayer: 'organizer', organizerShare: '50',
};

export default function OnboardingClient({ authenticatedEmail }: { authenticatedEmail: string }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => withAuthenticatedEmail(emptyDraft, authenticatedEmail));
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [auctionId, setAuctionId] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(storageKey);
        if (saved) setDraft(withAuthenticatedEmail({ ...emptyDraft, ...JSON.parse(saved) }, authenticatedEmail));
      } catch { /* A local draft is optional until Supabase is connected. */ }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [authenticatedEmail]);
  useEffect(() => {
    if (!hydrated || auctionId) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify(draft)); } catch { /* Keep setup usable if local storage is unavailable. */ }
  }, [draft, hydrated, auctionId]);

  const update = (changes: Partial<Draft>) => setDraft(current => ({ ...current, ...changes }));
  const next = () => {
    setError('');
    if (step === 0 && (!draft.organization.trim() || !draft.contactName.trim())) return setError('Add your organization and name to continue.');
    if (step === 1 && !draft.auctionName.trim()) return setError('Give your event a name to continue.');
    if (step === 1 && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pageSlug(draft))) return setError('Choose a shareable auction link using letters, numbers, and single hyphens.');
    if (step === 1 && draft.eventType !== 'online_silent' && (!draft.venueName.trim() || !draft.eventDate)) return setError('Add the venue and event date to continue.');
    if (step === 1 && draft.eventType !== 'live' && (!draft.auctionDate || !draft.closeDate)) return setError('Add the online bidding opening and closing dates to continue.');
    if (step === 1 && draft.eventType !== 'live' && new Date(draft.closeDate).getTime() <= new Date(draft.auctionDate).getTime()) return setError('Online bidding must close after it opens.');
    if (step === 2 && draft.items.some(item => !item.title.trim())) return setError('Finish the item name or remove the empty row.');
    setStep(current => Math.min(current + 1, 4));
  };
  const launch = async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/auction', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', key: crypto.randomUUID(), organization: draft.organization.trim(), nonprofitSlug: pageSlug(draft), name: draft.auctionName.trim(), eventType: draft.eventType, eventDescription: draft.description.trim(), timezone: draft.timezone, openDate: draft.eventType === 'live' ? undefined : draft.auctionDate, closeDate: draft.eventType === 'live' ? undefined : draft.closeDate, eventDate: draft.eventDate || undefined, eventTime: draft.eventTime || undefined, venueName: draft.venueName.trim() || undefined, venueAddress: draft.venueAddress.trim() || undefined, planningNotes: draft.planningNotes.trim() || undefined, plannedLiveAuction: draft.plannedLiveAuction, plannedSilentAuction: draft.plannedSilentAuction, plannedDonationAppeal: draft.plannedDonationAppeal, commissionPayer: draft.commissionPayer, organizerShare: organizationShare, items: draft.items.map(item => ({ title: item.title.trim(), value: Math.round((Number(item.value) || 0) * 100), source: item.source, packageCode: item.packageCode })) }),
      });
      const data = await response.json() as { id?: string; error?: string };
      if (!response.ok || !data.id) throw Error(data.error || 'Unable to create your fundraiser.');
      setAuctionId(data.id);
      window.localStorage.removeItem(storageKey);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create your fundraiser.');
    } finally { setBusy(false); }
  };
  const addItem = () => update({ items: [...draft.items, { id: crypto.randomUUID(), title: '', value: '', source: 'custom' }] });
  const toggleTravelPackage = (travelPackage: TravelPackage) => {
    const id = `give-holidays-${travelPackage.id}`;
    update({ items: draft.items.some(item => item.id === id)
      ? draft.items.filter(item => item.id !== id)
      : [...draft.items, { id, title: `${travelPackage.destination} getaway`, value: '', source: 'give-holidays', packageCode: travelPackage.code }] });
  };
  const editItem = (id: string, changes: Partial<Item>) => update({ items: draft.items.map(item => item.id === id ? { ...item, ...changes } : item) });
  const removeItem = (id: string) => update({ items: draft.items.filter(item => item.id !== id) });
  const organizationShare = Math.min(100, Math.max(0, Number(draft.organizerShare) || 0));
  const bidderShare = draft.commissionPayer === 'organizer' ? 0 : draft.commissionPayer === 'bidder' ? 100 : 100 - organizationShare;

  return <main className="min-h-screen bg-[#f8faf9] px-4 py-5 pb-16 sm:px-5 md:py-12"><div className="mx-auto max-w-3xl">
    <header className="mb-8 flex items-center justify-between gap-4 sm:mb-12"><Link href="/" className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-[#175b47]"><span className="grid size-9 place-items-center rounded-full bg-[#175b47] text-white"><Leaf size={21}/></span>gather<span className="text-[#78a68b]">.</span></Link><span className="text-xs text-muted-foreground">{hydrated && !auctionId ? 'Draft saved on this device' : 'Set up your fundraiser'}</span></header>
    <ol className="mb-9 flex items-start justify-between gap-1 sm:mb-12">{steps.map((label, index) => <li key={label} className="flex min-w-0 flex-1 items-center gap-2"><span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${index <= step ? 'bg-[#175b47] text-white' : 'border bg-white text-muted-foreground'}`}>{index < step ? <CheckCircle2 size={16}/> : index + 1}</span><span className={`hidden text-xs leading-tight sm:block ${index <= step ? 'font-semibold text-[#175b47]' : 'text-muted-foreground'}`}>{label}</span>{index < 4 && <span className={`h-px min-w-2 flex-1 ${index < step ? 'bg-[#175b47]' : 'bg-[#dce6df]'}`}/>}</li>)}</ol>
    <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7 md:p-10">
      {auctionId ? <Complete auctionId={auctionId}/> : <>{step === 0 && <Organization draft={draft} update={update}/>}
        {step === 1 && <AuctionDetails draft={draft} update={update}/>}
        {step === 2 && <Items eventType={draft.eventType} items={draft.items} addItem={addItem} editItem={editItem} removeItem={removeItem} toggleTravelPackage={toggleTravelPackage}/>}
        {step === 3 && <Payment draft={draft} update={update} organizationShare={organizationShare} bidderShare={bidderShare}/>}
        {step === 4 && <Review draft={draft} organizationShare={organizationShare} bidderShare={bidderShare}/>}
        {error && <p role="alert" className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <footer className="mt-9 flex items-center justify-between gap-4 border-t pt-6"><div>{step > 0 && <Button type="button" variant="ghost" onClick={() => { setError(''); setStep(current => current - 1); }}><ArrowLeft size={16}/>Back</Button>}</div>{step < 4 ? <Button type="button" className="h-11 px-5" onClick={next}>Continue <ArrowRight size={16}/></Button> : <Button type="button" className="h-11 px-5" disabled={busy} onClick={launch}>{busy ? 'Launching…' : 'Launch fundraiser'} <ArrowRight size={16}/></Button>}</footer>
      </>}
    </section><p className="mt-6 text-center text-xs text-muted-foreground">Simple setup now. Advanced options stay out of your way.</p>
  </div></main>;
}

function Heading({ step, title, copy }: { step: string; title: string; copy: string }) { return <><p className="eyebrow mb-3 text-[#648371]">{step}</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1><p className="mt-3 max-w-xl leading-relaxed text-muted-foreground">{copy}</p></>; }
const cleanSlug = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
const pageSlug = (draft: Draft) => draft.nonprofitSlug || cleanSlug(draft.organization);
function Organization({ draft, update }: { draft: Draft; update: (changes: Partial<Draft>) => void }) { return <div className="max-w-xl"><Heading step="STEP 1 OF 5" title="Your organization." copy="Start with the essentials. You can update this later."/><div className="mt-8 space-y-5"><label className="block text-sm font-medium">Organization name<Input autoFocus className="mt-2 h-12" value={draft.organization} onChange={event => update({ organization: event.target.value })} placeholder="Community Arts Foundation"/></label><label className="block text-sm font-medium">Your name<Input className="mt-2 h-12" value={draft.contactName} onChange={event => update({ contactName: event.target.value })} placeholder="Alex Morgan"/></label><label className="block text-sm font-medium">Account email<Input className="mt-2 h-12 bg-[#f5f8f6] text-muted-foreground" type="email" value={draft.email} readOnly aria-readonly="true"/><span className="mt-2 block text-xs font-normal leading-5 text-muted-foreground">This is the verified email used to sign in to Gather. An organization contact email, when needed, is managed separately.</span></label></div></div>; }
function AuctionDetails({ draft, update }: { draft: Draft; update: (changes: Partial<Draft>) => void }) {
  const slug = pageSlug(draft);
  const inPerson = draft.eventType !== 'online_silent';
  const onlineBidding = draft.eventType !== 'live';
  return <div><Heading step="STEP 2 OF 5" title="What are you planning?" copy="Choose the experience that fits your fundraiser. We’ll tailor the remaining setup."/>
    <div className="mt-8 grid gap-3" role="radiogroup" aria-label="Event format">
      <EventTypeCard active={draft.eventType === 'online_silent'} icon={<Globe2 size={21}/>} title="Online Silent Auction" copy="Supporters browse and bid from anywhere. No ticket required." onClick={() => update({ eventType: 'online_silent' })}/>
      <EventTypeCard active={draft.eventType === 'live'} icon={<Building2 size={21}/>} title="Live Fundraising Event" copy="Host an in-person gala with live lots and an optional donation appeal." onClick={() => update({ eventType: 'live' })}/>
      <EventTypeCard active={draft.eventType === 'hybrid'} icon={<Radio size={21}/>} title="Hybrid Event" copy="Bring together in-person guests and remote online bidders." onClick={() => update({ eventType: 'hybrid' })}/>
    </div>
    <div className="mt-8 space-y-5 border-t pt-7">
      <label className="block text-sm font-medium">Event name<Input className="mt-2 h-12" value={draft.auctionName} onChange={event => update({ auctionName: event.target.value })} placeholder="Annual Giving Auction"/></label>
      <label className="block text-sm font-medium">Short description<textarea className="mt-2 min-h-24 w-full rounded-md border bg-transparent px-3 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#175b47]/30" value={draft.description} onChange={event => update({ description: event.target.value })} maxLength={1000} placeholder="Tell supporters what this fundraiser makes possible."/></label>
      <label className="block text-sm font-medium">Nonprofit’s shareable event link<div className="mt-2 flex h-12 items-center overflow-hidden rounded-md border bg-white focus-within:ring-2 focus-within:ring-[#175b47]/30"><span className="border-r bg-[#f5f8f6] px-3 text-sm text-muted-foreground">/n/</span><input className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" value={slug} onChange={event => update({ nonprofitSlug: cleanSlug(event.target.value) })} minLength={3} maxLength={48} required aria-label="Nonprofit shareable event link" placeholder="community-arts"/></div><span className="mt-2 block text-xs font-normal text-muted-foreground">Your page will be available at <strong className="font-medium text-foreground">/n/{slug || 'your-event'}</strong>.</span></label>
      {inPerson && <><div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-medium">Venue<Input className="mt-2 h-12" value={draft.venueName} onChange={event => update({ venueName: event.target.value })} placeholder="The Grand Ballroom"/></label><label className="block text-sm font-medium">City or address<Input className="mt-2 h-12" value={draft.venueAddress} onChange={event => update({ venueAddress: event.target.value })} placeholder="Denver, CO"/></label><label className="block text-sm font-medium">Event date<Input className="mt-2 h-12" type="date" value={draft.eventDate} onChange={event => update({ eventDate: event.target.value })}/></label><label className="block text-sm font-medium">Event time <span className="font-normal text-muted-foreground">(optional)</span><Input className="mt-2 h-12" type="time" value={draft.eventTime} onChange={event => update({ eventTime: event.target.value })}/></label></div><CapabilityIntent draft={draft} update={update}/></>}
      {onlineBidding && <div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-medium">Online bidding opens<Input className="mt-2 h-12" type="date" value={draft.auctionDate} onChange={event => update({ auctionDate: event.target.value })}/></label><label className="block text-sm font-medium">Online bidding closes<Input className="mt-2 h-12" type="date" value={draft.closeDate} onChange={event => update({ closeDate: event.target.value })}/></label></div>}
      <label className="block text-sm font-medium">Event time zone<select className="mt-2 h-12 w-full rounded-md border bg-white px-3 text-sm" value={draft.timezone} onChange={event => update({ timezone: event.target.value })}><option value="America/Denver">Mountain Time</option><option value="America/Chicago">Central Time</option><option value="America/New_York">Eastern Time</option><option value="America/Los_Angeles">Pacific Time</option></select></label>
      {inPerson && <label className="block text-sm font-medium">Planning notes <span className="font-normal text-muted-foreground">(optional)</span><textarea className="mt-2 min-h-20 w-full rounded-md border bg-transparent px-3 py-3 text-sm" value={draft.planningNotes} onChange={event => update({ planningNotes: event.target.value })} maxLength={2000}/></label>}
      <p className="rounded-xl bg-[#f5f8f6] p-4 text-sm leading-relaxed text-muted-foreground">{draft.eventType === 'online_silent' ? 'Bidding opens and closes according to the dates you choose.' : draft.eventType === 'live' ? 'Publishing creates your event page. It does not start live bidding or activate event-night tools.' : 'Remote supporters can bid without buying admission. Live event-night operations will start separately when available.'}</p>
    </div>
  </div>;
}
function EventTypeCard({ active, icon, title, copy, onClick }: { active: boolean; icon: React.ReactNode; title: string; copy: string; onClick: () => void }) { return <button type="button" role="radio" aria-checked={active} onClick={onClick} className={`flex min-h-24 items-center gap-4 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#175b47] focus-visible:ring-offset-2 ${active ? 'border-[#175b47] bg-[#f3f8f4] ring-1 ring-[#175b47]' : 'hover:border-[#a8beae]'}`}><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#eaf1ed] text-[#175b47]">{icon}</span><span className="min-w-0 flex-1"><span className="block font-semibold">{title}</span><span className="mt-1 block text-sm text-muted-foreground">{copy}</span></span><span className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${active ? 'border-[#175b47]' : 'border-[#b8c6bc]'}`}>{active && <span className="size-2.5 rounded-full bg-[#175b47]"/>}</span></button>; }
function CapabilityIntent({ draft, update }: { draft: Draft; update: (changes: Partial<Draft>) => void }) { const options: { key: 'plannedLiveAuction' | 'plannedSilentAuction' | 'plannedDonationAppeal'; label: string }[] = [{ key: 'plannedLiveAuction', label: 'Live auction lots' }, { key: 'plannedSilentAuction', label: 'Silent auction items' }, { key: 'plannedDonationAppeal', label: 'Donation appeal / Fund-a-Need' }]; return <fieldset className="rounded-xl border p-4"><legend className="px-1 text-sm font-medium">What are you planning?</legend><p className="mb-3 text-xs text-muted-foreground">These choices help us prepare your workspace. Event-night tools are not activated during setup.</p><div className="grid gap-2 sm:grid-cols-3">{options.map(option => <label key={option.key} className="flex items-start gap-2 rounded-lg bg-[#f8faf9] p-3 text-sm"><input className="mt-1 accent-[#175b47]" type="checkbox" checked={draft[option.key]} onChange={event => update({ [option.key]: event.target.checked })}/>{option.label}</label>)}</div></fieldset>; }
function Items({ eventType, items, addItem, editItem, removeItem, toggleTravelPackage }: { eventType: EventType; items: Item[]; addItem: () => void; editItem: (id: string, changes: Partial<Item>) => void; removeItem: (id: string) => void; toggleTravelPackage: (travelPackage: TravelPackage) => void }) {
  const selectedPackages = new Set(items.filter(item => item.source === 'give-holidays').map(item => item.id));
  const customItems = items.filter(item => item.source !== 'give-holidays');
  return <div><Heading step="STEP 3 OF 5" title="Add a few auction items." copy={eventType === 'live' ? 'Prepare items for your event. Live-lot sequencing and clerk controls will be added in Gather Live.' : eventType === 'hybrid' ? 'Add online silent-auction items now. Live-lot operations remain separate.' : 'Choose Give Holidays destinations or add your own donated items.'}/>
    {eventType !== 'online_silent' && <div className="mt-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><CalendarDays className="mt-0.5 shrink-0" size={18}/><div><strong>Event plan saved</strong><p className="mt-1 text-amber-800">Ticketing, check-in, paddles, Fund-a-Need, and the live clerk console are pending modules. Nothing here starts a live session.</p></div></div>}
    <div className="mt-8 flex items-end justify-between gap-4"><div><p className="font-semibold">Give Holidays travel packages</p><p className="mt-1 text-sm text-muted-foreground">Select any destinations you want to feature.</p></div><span className="shrink-0 text-xs font-medium text-[#175b47]">{selectedPackages.size} selected</span></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">{travelPackages.map(travelPackage => { const selected = selectedPackages.has(`give-holidays-${travelPackage.id}`); return <button type="button" key={travelPackage.id} aria-pressed={selected} onClick={() => toggleTravelPackage(travelPackage)} className={`group overflow-hidden rounded-xl border bg-white text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#175b47] focus-visible:ring-offset-2 ${selected ? 'border-[#175b47] shadow-sm ring-1 ring-[#175b47]' : 'hover:-translate-y-0.5 hover:border-[#a8beae] hover:shadow-sm'}`}>
      <span className="relative flex h-24 items-end overflow-hidden p-3 text-white" style={{ background: travelPackage.tone }}><Plane className="absolute right-3 top-3 opacity-70" size={20}/><span className="text-2xl font-semibold tracking-[-.04em] opacity-90">{travelPackage.code}</span>{selected && <span className="absolute bottom-3 right-3 grid size-7 place-items-center rounded-full bg-white text-[#175b47]"><Check size={16} strokeWidth={3}/></span>}</span>
      <span className="block p-3"><span className="block font-semibold leading-tight">{travelPackage.destination}</span><span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={12}/>{travelPackage.region}</span><span className="mt-3 inline-flex rounded-full bg-[#eef4f0] px-2 py-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#175b47]">Give Holidays</span></span>
    </button>; })}</div>
    <div className="mt-8 border-t pt-6"><div className="flex items-center justify-between gap-4"><div><p className="font-semibold">Your donated items</p><p className="mt-1 text-sm text-muted-foreground">Add anything outside the travel catalog.</p></div><Button type="button" variant="outline" onClick={addItem}><Plus size={16}/>Add item</Button></div>{customItems.length > 0 && <div className="mt-4 space-y-3">{customItems.map((item, index) => <div key={item.id} className="grid grid-cols-[1fr_7rem_2.75rem] gap-2"><Input className="h-12" value={item.title} onChange={event => editItem(item.id, { title: event.target.value })} placeholder={`Item ${index + 1} title`}/><Input className="h-12" inputMode="numeric" value={item.value} onChange={event => editItem(item.id, { value: event.target.value })} placeholder="Value" aria-label={`${item.title || `Item ${index + 1}`} value`}/><Button type="button" variant="outline" className="h-12 px-0" onClick={() => removeItem(item.id)} aria-label="Remove item"><Trash2 size={16}/></Button></div>)}</div>}</div>
  </div>;
}
function Payment({ draft, update, organizationShare, bidderShare }: { draft: Draft; update: (changes: Partial<Draft>) => void; organizationShare: number; bidderShare: number }) { const pick = (commissionPayer: Draft['commissionPayer']) => update({ commissionPayer }); return <div className="max-w-xl"><Heading step="STEP 4 OF 5" title="Payment & fees." copy="Gather charges a 5% platform commission on eligible auction transactions. Payment processing fees are shown separately at checkout."/><div className="mt-8 grid gap-3"><Fee active={draft.commissionPayer === 'organizer'} title="Organization covers the 5%" copy="The nonprofit absorbs the platform commission." onClick={() => pick('organizer')}/><Fee active={draft.commissionPayer === 'split'} title="Split the 5%" copy="Choose how the platform commission is divided." onClick={() => pick('split')}/><Fee active={draft.commissionPayer === 'bidder'} title="Winning bidder covers the 5%" copy="The platform commission is added to eligible winning invoices." onClick={() => pick('bidder')}/></div>{draft.commissionPayer === 'split' && <div className="mt-5 rounded-xl bg-[#f5f8f6] p-4"><label className="block text-sm font-medium">Organization share of the 5% commission<Input className="mt-2 h-12" type="number" min="0" max="100" value={draft.organizerShare} onChange={event => update({ organizerShare: event.target.value })}/></label><p className="mt-2 text-sm text-muted-foreground">Organization: {organizationShare}% · Winning bidder: {bidderShare}%</p></div>}{draft.eventType !== 'online_silent' && <p className="mt-5 rounded-xl bg-[#f5f8f6] p-4 text-sm text-muted-foreground">Event-night payment readiness will be completed in Gather Live. This setup does not create ticket charges, pledges, or live-auction obligations.</p>}<p className="mt-5 flex gap-2 text-xs leading-relaxed text-muted-foreground"><CircleHelp size={15} className="mt-0.5 shrink-0"/>Give Holidays travel packages include a separate package markup in their displayed package pricing. Payment processing fees are disclosed separately.</p></div>; }
function Fee({ active, title, copy, onClick }: { active: boolean; title: string; copy: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={`min-h-20 rounded-xl border p-4 text-left transition-colors ${active ? 'border-[#175b47] bg-[#eaf1ed]' : 'hover:border-[#a8beae]'}`}><span className="block font-medium">{title}</span><span className="mt-1 block text-sm text-muted-foreground">{copy}</span></button>; }
function Review({ draft, organizationShare, bidderShare }: { draft: Draft; organizationShare: number; bidderShare: number }) { const allocation = draft.commissionPayer === 'organizer' ? 'Organization covers 100%' : draft.commissionPayer === 'bidder' ? 'Winning bidder covers 100%' : `Organization ${organizationShare}% · Winning bidder ${bidderShare}%`; const typeLabel = draft.eventType === 'online_silent' ? 'Online Silent Auction' : draft.eventType === 'live' ? 'Live Fundraising Event' : 'Hybrid Event'; const launchCopy = draft.eventType === 'online_silent' ? 'Publish the auction page. Online bidding follows your configured schedule.' : draft.eventType === 'live' ? 'Publish the event page. Live bidding and event-night operations do not start on publish.' : 'Publish the event page and schedule online bidding. Live operations start separately.'; return <div className="max-w-xl"><span className="mb-6 inline-flex rounded-2xl bg-[#eaf1ed] p-4 text-[#175b47]"><Sparkles size={26}/></span><Heading step="STEP 5 OF 5" title="Ready to publish." copy={launchCopy}/><dl className="mt-8 divide-y rounded-xl border"><Summary label="Shareable event link" value={`/n/${pageSlug(draft)}`}/><Summary label="Organization" value={draft.organization}/><Summary label="Event type" value={typeLabel}/><Summary label="Event" value={draft.auctionName}/>{draft.eventType !== 'online_silent' && <Summary label="Venue" value={`${draft.venueName}${draft.venueAddress ? ` · ${draft.venueAddress}` : ''}`}/>}<Summary label="Time zone" value={draft.timezone}/>{draft.eventType !== 'live' && <Summary label="Online bidding" value={`${draft.auctionDate} through ${draft.closeDate}`}/>}<Summary label="Items to add" value={draft.items.length ? `${draft.items.length} item${draft.items.length === 1 ? '' : 's'}` : 'Optional — add after publishing'}/><Summary label="5% commission" value={allocation}/><Summary label="Payments" value="Processing fees disclosed separately"/></dl>{draft.eventType !== 'online_silent' && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><strong className="text-amber-950">Needs setup later</strong><p className="mt-1 text-amber-800">Ticketing, guest check-in, paddles, Fund-a-Need, and live-auction controls are not activated by publishing this event.</p></div>}<p className="mt-5 flex gap-2 text-xs leading-relaxed text-muted-foreground"><CircleHelp size={15} className="mt-0.5 shrink-0"/>Publishing a live or hybrid event never starts a live bidding session.</p></div>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-sm font-medium">{value}</dd></div>; }
function Complete({ auctionId }: { auctionId: string }) { const url = typeof window === 'undefined' ? '' : `${window.location.origin}/?auction=${auctionId}`; return <div className="max-w-xl"><span className="mb-7 inline-flex rounded-2xl bg-[#eaf1ed] p-4 text-[#175b47]"><CheckCircle2 size={28}/></span><p className="eyebrow mb-3 text-[#648371]">YOUR FUNDRAISER IS READY</p><h1 className="text-3xl font-semibold tracking-tight">Your auction has a home.</h1><p className="mt-4 leading-relaxed text-muted-foreground">Your workspace is ready. Add the final item details and share your auction when it feels right.</p><div className="mt-7 rounded-xl bg-[#f5f8f6] p-4"><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your auction link</p><p className="mt-2 break-all text-sm font-medium">{url}</p></div><div className="mt-8 flex flex-wrap gap-3"><Button asChild><a href={`/admin?auction=${auctionId}`}>Open workspace <ArrowRight size={16}/></a></Button><Button variant="outline" asChild><a href={`/?auction=${auctionId}`}>View auction</a></Button></div></div>; }

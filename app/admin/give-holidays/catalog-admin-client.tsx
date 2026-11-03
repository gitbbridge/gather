'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Leaf, LoaderCircle, MapPin, Plane, Plus, Save } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Terms = { nights?: string; guests?: string; validity?: string; blackoutDates?: string; inclusions?: string; restrictions?: string };
type TravelPackage = {
  id?: string; providerCode: string; destination: string; region: string; title: string; summary: string; imageUrl: string;
  wholesaleCostCents: number; platformMarkupCents: number; fairMarketValueCents: number; suggestedStartingBidCents: number;
  status: 'draft' | 'available' | 'paused' | 'retired'; isActive: boolean; terms: Terms;
};

const emptyPackage: TravelPackage = {
  providerCode: '', destination: '', region: '', title: '', summary: '', imageUrl: '', wholesaleCostCents: 0,
  platformMarkupCents: 0, fairMarketValueCents: 0, suggestedStartingBidCents: 0, status: 'draft', isActive: false, terms: {},
};

const dollars = (cents: number) => cents ? String(cents / 100) : '';
const cents = (value: string) => Math.round((Number(value) || 0) * 100);

export default function CatalogAdminClient() {
  const [packages, setPackages] = useState<TravelPackage[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [draft, setDraft] = useState<TravelPackage>(emptyPackage);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const selected = useMemo(() => packages.find(item => item.id === selectedId), [packages, selectedId]);

  useEffect(() => {
    fetch('/api/admin/give-holidays').then(async response => {
      const result = await response.json() as { packages?: TravelPackage[]; error?: string };
      if (!response.ok) throw new Error(result.error || 'Unable to load catalog.');
      const list = result.packages || [];
      setPackages(list);
      if (list[0]?.id) setSelectedId(list[0].id);
    }).catch(error => toast.error(error.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (selected) setDraft(structuredClone(selected)); }, [selected]);
  const update = (changes: Partial<TravelPackage>) => setDraft(current => ({ ...current, ...changes }));
  const updateTerms = (changes: Partial<Terms>) => setDraft(current => ({ ...current, terms: { ...current.terms, ...changes } }));
  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/give-holidays', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
      const result = await response.json() as { package?: TravelPackage; error?: string };
      if (!response.ok || !result.package) throw new Error(result.error || 'Unable to save package.');
      setPackages(current => current.some(item => item.id === result.package!.id) ? current.map(item => item.id === result.package!.id ? result.package! : item) : [...current, result.package!].sort((a,b) => a.destination.localeCompare(b.destination)));
      setSelectedId(result.package.id || '');
      toast.success('Travel package saved');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to save package.'); }
    finally { setSaving(false); }
  };

  return <main className="min-h-screen bg-[#f8faf9] px-4 py-5 sm:px-6 lg:px-10 lg:py-8"><Toaster richColors/><div className="mx-auto max-w-7xl">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><a href="/admin" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground"><ArrowLeft size={16}/>Auction dashboard</a><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-full bg-[#175b47] text-white"><Plane size={21}/></span><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#648371]">Gather platform admin</p><h1 className="text-3xl font-semibold tracking-tight">Give Holidays catalog</h1></div></div></div><Button variant="outline" onClick={() => { setSelectedId(''); setDraft(emptyPackage); }}><Plus size={16}/>New package</Button></header>
    <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">Manage the source pricing and fulfillment terms nonprofits see when they add risk-free travel experiences. Draft packages never appear in the public catalog.</p>
    <div className="mt-8 grid gap-6 lg:grid-cols-[22rem_1fr]"><aside className="space-y-3">{loading ? <div className="rounded-xl border bg-white p-6 text-sm text-muted-foreground"><LoaderCircle className="mb-3 animate-spin"/>Loading catalog…</div> : packages.map((item, index) => <button key={item.id} onClick={() => setSelectedId(item.id || '')} className={`w-full overflow-hidden rounded-xl border bg-white text-left transition ${selectedId === item.id ? 'border-[#175b47] ring-1 ring-[#175b47]' : 'hover:border-[#a8beae]'}`}><span className={`block h-2 ${['bg-[#d68054]','bg-[#2e7259]','bg-[#8c653f]','bg-[#5e607b]','bg-[#197e85]','bg-[#394957]'][index % 6]}`}/><span className="block p-4"><span className="flex items-start justify-between gap-3"><span className="font-semibold">{item.destination}</span><span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${item.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'}`}>{item.isActive ? 'Live' : item.status}</span></span><span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={12}/>{item.region} · {item.providerCode}</span></span></button>)}</aside>
      <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#648371]">{draft.id ? 'Package details' : 'New package'}</p><h2 className="mt-2 text-2xl font-semibold">{draft.title || 'Untitled travel package'}</h2></div>{draft.isActive && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800"><Check size={13}/>Available</span>}</div>
        <div className="mt-7 grid gap-5 sm:grid-cols-2"><Field label="Destination"><Input value={draft.destination} onChange={e => update({ destination: e.target.value })}/></Field><Field label="Region"><Input value={draft.region} onChange={e => update({ region: e.target.value })}/></Field><Field label="Package title" wide><Input value={draft.title} onChange={e => update({ title: e.target.value })}/></Field><Field label="Give Holidays code"><Input value={draft.providerCode} onChange={e => update({ providerCode: e.target.value.toUpperCase() })}/></Field><Field label="Image URL"><Input value={draft.imageUrl} onChange={e => update({ imageUrl: e.target.value })} placeholder="https://…"/></Field><Field label="Summary" wide><textarea className="min-h-24 w-full rounded-md border p-3 text-sm" value={draft.summary} onChange={e => update({ summary: e.target.value })}/></Field></div>
        <h3 className="mt-8 border-t pt-7 font-semibold">Pricing</h3><div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><Money label="Wholesale cost" value={draft.wholesaleCostCents} onChange={value => update({ wholesaleCostCents: value })}/><Money label="Gather markup" value={draft.platformMarkupCents} onChange={value => update({ platformMarkupCents: value })}/><Money label="Fair-market value" value={draft.fairMarketValueCents} onChange={value => update({ fairMarketValueCents: value })}/><Money label="Suggested opening bid" value={draft.suggestedStartingBidCents} onChange={value => update({ suggestedStartingBidCents: value })}/></div>
        <h3 className="mt-8 border-t pt-7 font-semibold">Package terms</h3><div className="mt-4 grid gap-5 sm:grid-cols-2"><Field label="Nights"><Input value={draft.terms.nights || ''} onChange={e => updateTerms({ nights: e.target.value })} placeholder="5 nights"/></Field><Field label="Guests"><Input value={draft.terms.guests || ''} onChange={e => updateTerms({ guests: e.target.value })} placeholder="2 guests"/></Field><Field label="Validity" wide><Input value={draft.terms.validity || ''} onChange={e => updateTerms({ validity: e.target.value })} placeholder="Travel within 18 months of purchase"/></Field><Field label="Blackout dates" wide><Input value={draft.terms.blackoutDates || ''} onChange={e => updateTerms({ blackoutDates: e.target.value })}/></Field><Field label="Inclusions" wide><textarea className="min-h-24 w-full rounded-md border p-3 text-sm" value={draft.terms.inclusions || ''} onChange={e => updateTerms({ inclusions: e.target.value })}/></Field><Field label="Restrictions" wide><textarea className="min-h-24 w-full rounded-md border p-3 text-sm" value={draft.terms.restrictions || ''} onChange={e => updateTerms({ restrictions: e.target.value })}/></Field></div>
        <div className="mt-8 grid gap-5 border-t pt-7 sm:grid-cols-2"><Field label="Catalog status"><select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={draft.status} onChange={e => update({ status: e.target.value as TravelPackage['status'] })}><option value="draft">Draft</option><option value="available">Available</option><option value="paused">Paused</option><option value="retired">Retired</option></select></Field><label className="flex min-h-16 items-center justify-between gap-4 rounded-xl border p-4"><span><span className="block text-sm font-medium">Show in nonprofit catalog</span><span className="mt-1 block text-xs text-muted-foreground">Requires available status, cost, and FMV.</span></span><input type="checkbox" className="size-5 accent-[#175b47]" checked={draft.isActive} onChange={e => update({ isActive: e.target.checked })}/></label></div>
        <div className="mt-8 flex justify-end"><Button className="min-w-36" onClick={save} disabled={saving}>{saving ? <LoaderCircle className="animate-spin"/> : <Save size={16}/>} {saving ? 'Saving…' : 'Save package'}</Button></div>
      </section></div>
    <footer className="mt-8 flex items-center gap-2 border-t pt-6 text-xs text-muted-foreground"><Leaf size={14}/>Give Holidays pricing is internal. Bidders see the package description, terms, retail value, and auction price.</footer>
  </div></main>;
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={`block text-sm font-medium ${wide ? 'sm:col-span-2' : ''}`}>{label}<span className="mt-2 block">{children}</span></label>; }
function Money({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="block text-sm font-medium">{label}<span className="mt-2 flex h-10 items-center overflow-hidden rounded-md border"><span className="border-r bg-muted px-3 text-sm text-muted-foreground">$</span><input className="h-full min-w-0 flex-1 px-3 text-sm outline-none" inputMode="decimal" value={dollars(value)} onChange={e => onChange(cents(e.target.value))}/></span></label>; }

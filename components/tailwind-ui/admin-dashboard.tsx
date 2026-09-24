'use client';

import { ArrowUpRight, CheckCircle2, CircleAlert, ClipboardCheck, Clock3, Download, ExternalLink, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

type AdminDashboardProps = {
  auction: { name: string; organization: string; items: number; bidders: number; bids: number; total: string; goal: string; progress: number; paused: boolean; ends: string };
  nonprofit?: { name: string; slug: string } | null;
  onManageItems: () => void;
  onManagePage: () => void;
  onCreateAuction: () => void;
  onExport: () => void;
  onCloseout: () => void;
};

// Selected Tailwind UI Plus patterns:
// - page-examples/home-screens/sidebar_on_dark.jsx for the admin shell rhythm
// - data-display/stats/with_trending.jsx for compact metric cards
// - headings/section-headings/with_actions.jsx for action-led section headers
// - layout/list-containers/separate_cards.jsx for operational checklists
export function AdminDashboard({ auction, nonprofit, onManageItems, onManagePage, onCreateAuction, onExport, onCloseout }: AdminDashboardProps) {
  const checks = [
    { label: 'Nonprofit page', detail: nonprofit ? 'Shareable page is ready' : 'Create your public page', done: Boolean(nonprofit), action: onManagePage },
    { label: 'Auction items', detail: auction.items ? `${auction.items} items listed` : 'Add your first item', done: auction.items > 0, action: onManageItems },
    { label: 'Bidder access', detail: 'Registration is required before bidding', done: true, action: onManagePage },
  ];

  return <div className="space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="eyebrow text-muted-foreground mb-2">ORGANIZER WORKSPACE</p><h1 className="text-3xl font-semibold tracking-tight">Your auction at a glance</h1><p className="mt-2 text-muted-foreground">Keep {auction.name} moving forward.</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={onCloseout}><ClipboardCheck size={16}/>Closeout</Button><Button variant="outline" onClick={onExport}><Download size={16}/>Export report</Button><Button onClick={onCreateAuction}><ArrowUpRight size={16}/>New auction</Button></div>
    </div>

    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-[#e0e7e2] sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Test commitments" value={auction.total} detail={`of ${auction.goal} goal`} />
      <Metric label="Auction items" value={String(auction.items)} detail="Across your catalog" />
      <Metric label="Participating bidders" value={String(auction.bidders)} detail={`${auction.bids} bids so far`} />
      <Metric label="Auction status" value={auction.paused ? 'Paused' : 'Open'} detail={auction.ends} tone={auction.paused ? 'warning' : 'positive'} />
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
      <section className="panel">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow text-muted-foreground mb-2">FUNDRAISING PROGRESS</p><h2 className="text-xl font-semibold">You’re building momentum</h2></div><span className="text-lg font-semibold">{auction.progress}%</span></div>
        <Progress value={auction.progress} className="mt-6 h-2 bg-[#e5eee8]" />
        <div className="mt-4 flex justify-between text-sm text-muted-foreground"><span>{auction.total} raised in test commitments</span><span>{auction.goal} target</span></div>
        <div className="mt-7 flex flex-wrap gap-3"><Button onClick={onManageItems}>Review items <ArrowUpRight size={16}/></Button>{nonprofit && <Button variant="outline" asChild><a href={`/n/${nonprofit.slug}`} target="_blank" rel="noreferrer">View nonprofit page <ExternalLink size={16}/></a></Button>}</div>
      </section>
      <section className="panel"><div className="flex items-center gap-2 mb-5"><Users size={18} className="text-primary"/><h2 className="font-semibold">Launch checklist</h2></div><div className="space-y-4">{checks.map(check=><button key={check.label} onClick={check.action} className="flex w-full items-start gap-3 text-left rounded-lg p-2 -m-2 hover:bg-muted"><span className="mt-0.5">{check.done ? <CheckCircle2 size={18} className="text-[#2f7d5b]"/> : <CircleAlert size={18} className="text-amber-600"/>}</span><span className="min-w-0"><span className="block text-sm font-medium">{check.label}</span><span className="block text-xs text-muted-foreground mt-1">{check.detail}</span></span></button>)}</div></section>
    </div>

    <div className="grid gap-6 md:grid-cols-2"><section className="panel"><div className="flex items-start gap-3"><Clock3 className="text-primary mt-0.5" size={19}/><div><h2 className="font-semibold">Ready for your own fundraiser?</h2><p className="text-sm text-muted-foreground mt-2">Create another auction under the same nonprofit page for seasonal campaigns, galas, or year-round giving.</p><Button variant="link" className="px-0 mt-3" onClick={onCreateAuction}>Create an auction <ArrowUpRight size={15}/></Button></div></div></section><section className="panel"><div className="flex items-start gap-3"><CircleAlert className="text-amber-600 mt-0.5" size={19}/><div><h2 className="font-semibold">Before collecting real funds</h2><p className="text-sm text-muted-foreground mt-2">Connect payments, public bidder accounts, email/SMS, settlement, refunds, and payout reconciliation before launch.</p><Button variant="link" className="px-0 mt-3" onClick={onManagePage}>Review nonprofit page <ArrowUpRight size={15}/></Button></div></div></section></div>
  </div>;
}

function Metric({ label, value, detail, tone = 'neutral' }: { label: string; value: string; detail: string; tone?: 'neutral' | 'positive' | 'warning' }) {
  return <div className="bg-white px-5 py-6"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-muted-foreground">{label}</p><span className={`size-2 rounded-full ${tone === 'positive' ? 'bg-[#2f7d5b]' : tone === 'warning' ? 'bg-amber-500' : 'bg-[#a8bbb0]'}`} /></div><p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>;
}

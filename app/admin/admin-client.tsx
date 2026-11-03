'use client';
import { useEffect, useState } from 'react';
import { AdminDashboard } from '@/components/tailwind-ui/admin-dashboard';
import { money } from '@/lib/auction';
import { toast } from 'sonner';

type AuctionSummary = { id: string; name: string; organization: string; starts: number; ends: number; paused: boolean; items: number; bids: number; total: number; status: 'open' | 'scheduled' | 'paused' | 'closed' };
type AdminData = { id: string; nonprofit: { id: string; name: string; slug: string } | null; list: AuctionSummary[]; state: { name: string; organization: string; items: unknown[]; supporters: number; bidCount: number; total: number; goal: number; paused: boolean; ends: number } };

export default function AdminClient() {
  const [data, setData] = useState<AdminData | null>(null);
  const [now] = useState(() => Date.now());
  useEffect(() => { const id = new URLSearchParams(window.location.search).get('auction'); fetch('/api/auction' + (id ? `?id=${encodeURIComponent(id)}` : '')).then(r => r.json() as Promise<AdminData>).then(setData).catch(() => toast.error('Unable to load your workspace.')); }, []);
  if (!data) return <div className="p-10 text-muted-foreground">Loading your admin workspace…</div>;
  const a = data.state;
  return <AdminDashboard
    auction={{ name: a.name, organization: a.organization, items: a.items.length, bidders: a.supporters, bids: a.bidCount, total: money(a.total), goal: money(a.goal), progress: Math.min(100, Math.round(a.total / a.goal * 100)), paused: a.paused, ends: a.ends > now ? `${Math.ceil((a.ends - now) / 86400000)} days remaining` : 'Auction closed' }}
    previousAuctions={(data.list || []).filter(auction => auction.id !== data.id).map(auction => ({ ...auction, total: money(auction.total), endsLabel: new Date(auction.ends).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }))}
    nonprofit={data.nonprofit}
    onManageItems={() => window.location.assign('/?view=Manage%20items')}
    onManagePage={() => window.location.assign('/?view=Nonprofit%20page')}
    onCreateAuction={() => window.location.assign('/onboarding')}
    onCloseout={() => window.location.assign(`/closeout?auction=${encodeURIComponent(data.id)}`)}
    onHomepage={() => window.location.assign(`/homepage?nonprofit=${encodeURIComponent(data.nonprofit?.id || '')}`)}
    onOpenAuction={auctionId => window.location.assign(`/admin?auction=${encodeURIComponent(auctionId)}`)}
    onViewAuction={auctionId => window.open(`/?auction=${encodeURIComponent(auctionId)}`, '_blank', 'noopener,noreferrer')}
    onExport={() => toast.info('Open Manage items to export the full CSV report.')} />;
}

'use client';
import { useEffect, useState } from 'react';
import { AdminDashboard } from '@/components/tailwind-ui/admin-dashboard';
import { money } from '@/lib/auction';
import { toast } from 'sonner';

export default function AdminClient() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { const id = new URLSearchParams(window.location.search).get('auction'); fetch('/api/auction' + (id ? `?id=${encodeURIComponent(id)}` : '')).then(r => r.json()).then(setData).catch(() => toast.error('Unable to load your workspace.')); }, []);
  if (!data) return <div className="p-10 text-muted-foreground">Loading your admin workspace…</div>;
  const a = data.state;
  return <AdminDashboard
    auction={{ name: a.name, organization: a.organization, items: a.items.length, bidders: a.supporters, bids: a.bidCount, total: money(a.total), goal: money(a.goal), progress: Math.min(100, Math.round(a.total / a.goal * 100)), paused: a.paused, ends: a.ends > Date.now() ? `${Math.ceil((a.ends - Date.now()) / 86400000)} days remaining` : 'Auction closed' }}
    nonprofit={data.nonprofit}
    onManageItems={() => window.location.assign('/?view=Manage%20items')}
    onManagePage={() => window.location.assign('/?view=Nonprofit%20page')}
    onCreateAuction={() => window.location.assign('/onboarding')}
    onCloseout={() => window.location.assign(`/closeout?auction=${encodeURIComponent(data.id)}`)}
    onExport={() => toast.info('Open Manage items to export the full CSV report.')} />;
}

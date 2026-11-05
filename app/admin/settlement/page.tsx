import { requireAppUser } from '@/lib/auth';
import SettlementClient from './settlement-client';

export const dynamic = 'force-dynamic';

export default async function SettlementPage({ searchParams }: { searchParams: Promise<{ auction?: string }> }) {
  const params = await searchParams;
  await requireAppUser(`/admin/settlement${params.auction ? `?auction=${encodeURIComponent(params.auction)}` : ''}`);
  return <SettlementClient auctionId={params.auction || ''} />;
}

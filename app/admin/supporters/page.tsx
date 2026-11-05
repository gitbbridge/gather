import { requireAppUser } from '@/lib/auth';
import SupportersClient from './supporters-client';

export const dynamic = 'force-dynamic';
export default async function SupportersPage({ searchParams }: { searchParams: Promise<{ organization?: string; email?: string }> }) {
  const params = await searchParams;
  await requireAppUser(`/admin/supporters${params.organization ? `?organization=${encodeURIComponent(params.organization)}` : ''}`);
  return <SupportersClient organizationId={params.organization || ''} initialSearch={params.email || ''} />;
}

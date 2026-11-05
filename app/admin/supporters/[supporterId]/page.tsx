import { requireAppUser } from '@/lib/auth';
import SupporterProfileClient from './supporter-profile-client';

export const dynamic = 'force-dynamic';
export default async function SupporterProfilePage({ params, searchParams }: { params: Promise<{ supporterId: string }>; searchParams: Promise<{ organization?: string }> }) {
  const { supporterId } = await params;
  const { organization = '' } = await searchParams;
  await requireAppUser(`/admin/supporters/${encodeURIComponent(supporterId)}?organization=${encodeURIComponent(organization)}`);
  return <SupporterProfileClient supporterId={supporterId} organizationId={organization} />;
}

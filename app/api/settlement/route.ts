import { z } from 'zod';
import { managedAuction } from '@/lib/organizer-access';
import { settlementCsv } from '@/lib/settlement';
import { loadEventSettlement } from '@/lib/supabase/settlement';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
const query = z.object({ auction: z.string().uuid(), format: z.enum(['json','csv']).default('json') });

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = query.safeParse({ auction: url.searchParams.get('auction'), format: url.searchParams.get('format') || 'json' });
    if (!parsed.success) return Response.json({ error: 'Choose a valid auction.' }, { status: 400 });
    const access = await managedAuction(parsed.data.auction);
    if (!access) return Response.json({ error: 'Auction not found or access denied.' }, { status: 404 });
    const settlement = await loadEventSettlement(parsed.data.auction, access.auction);
    settlement.auction.organizationId = access.nonprofit?.id || '';
    if (access.nonprofit?.id) {
      const emails = [...new Set(settlement.ledger.map(row => row.bidderEmail.trim().toLowerCase()).filter(Boolean))];
      if (emails.length) {
        const { data: supporters } = await createSupabaseAdminClient().from('supporters').select('id,normalized_email').eq('organization_id', access.nonprofit.id).in('normalized_email', emails);
        const supporterByEmail = new Map((supporters || []).map(supporter => [supporter.normalized_email, supporter.id]));
        settlement.ledger.forEach(row => { row.supporterId = supporterByEmail.get(row.bidderEmail.trim().toLowerCase()); });
      }
    }
    if (parsed.data.format === 'csv') {
      const safeName = access.auction.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'auction';
      return new Response(settlementCsv(settlement), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${safeName}-final-settlement.csv"`, 'cache-control': 'no-store' } });
    }
    return Response.json(settlement, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('Unable to build event settlement:', error);
    return Response.json({ error: 'Unable to build the event settlement.' }, { status: 500 });
  }
}

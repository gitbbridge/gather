import { getAppUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET() {
  try {
    const user = await getAppUser();
    if (!user) return json({ error: 'Sign in to view your wins.' }, 401);
    const { data, error } = await createSupabaseAdminClient().from('winner_invoices').select(`
      id,status,currency,hammer_subtotal_cents,bidder_platform_fee_cents,total_due_cents,due_at,paid_at,created_at,
      auctions(name,organization_id),
      winner_invoice_items(id,hammer_price_cents,bidder_fee_cents,auction_items(title,source))
    `).eq('payer_id', user.userId).order('created_at', { ascending: false });
    if (error) throw error;
    const invoices = (data || []).map(invoice => {
      const auction = Array.isArray(invoice.auctions) ? invoice.auctions[0] : invoice.auctions;
      return {
        id: invoice.id,
        status: invoice.status,
        currency: invoice.currency,
        auctionName: auction?.name || 'Auction',
        hammerSubtotalCents: invoice.hammer_subtotal_cents,
        bidderPlatformFeeCents: invoice.bidder_platform_fee_cents,
        totalDueCents: invoice.total_due_cents,
        dueAt: invoice.due_at,
        paidAt: invoice.paid_at,
        items: (invoice.winner_invoice_items || []).map(line => {
          const item = Array.isArray(line.auction_items) ? line.auction_items[0] : line.auction_items;
          return { id: line.id, title: item?.title || 'Auction item', source: item?.source || 'custom', hammerPriceCents: line.hammer_price_cents, bidderFeeCents: line.bidder_fee_cents };
        }),
      };
    });
    return json({ invoices });
  } catch (error) {
    console.error('Unable to load winner invoices:', error);
    return json({ error: 'Unable to load your winning invoices.' }, 500);
  }
}

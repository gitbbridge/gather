import type { Auction } from '@/lib/auction';
import { buildEventSettlement, type SettlementInvoice } from '@/lib/settlement';
import { createSupabaseAdminClient } from './admin';

const first = <T>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] || null : value || null;

export async function loadEventSettlement(auctionId: string, auction: Auction) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client.from('winner_invoices').select(`
    id,payer_id,status,last_payment_status,total_due_cents,processing_fee_cents,
    stripe_payment_intent_id,receipt_number,paid_at,
    payment_refunds(amount_cents,status),
    winner_invoice_items(
      id,hammer_price_cents,platform_fee_cents,organizer_fee_cents,bidder_fee_cents,
      give_holidays_wholesale_cost_cents,give_holidays_markup_cents,
      auction_items(id),fulfillments(status)
    )
  `).eq('auction_id', auctionId).order('created_at', { ascending: true });
  if (error) throw error;

  const identities = new Map<string, { name: string; email: string }>();
  await Promise.all((data || []).map(async invoice => {
    if (identities.has(invoice.payer_id)) return;
    const { data: authData } = await client.auth.admin.getUserById(invoice.payer_id);
    const email = authData.user?.email || '';
    const name = typeof authData.user?.user_metadata?.full_name === 'string' ? authData.user.user_metadata.full_name : email;
    identities.set(invoice.payer_id, { name, email });
  }));

  const invoices: SettlementInvoice[] = (data || []).map(invoice => {
    const identity = identities.get(invoice.payer_id) || { name: '', email: '' };
    return {
      id: invoice.id,
      payerId: invoice.payer_id,
      payerName: identity.name,
      payerEmail: identity.email,
      status: invoice.status,
      lastPaymentStatus: invoice.last_payment_status,
      totalDueCents: Number(invoice.total_due_cents || 0),
      processingFeeCents: Number(invoice.processing_fee_cents || 0),
      stripePaymentIntentId: invoice.stripe_payment_intent_id,
      receiptNumber: invoice.receipt_number,
      paidAt: invoice.paid_at,
      refundCents: (invoice.payment_refunds || []).filter(refund => refund.status === 'succeeded').reduce((sum, refund) => sum + Number(refund.amount_cents || 0), 0),
      lines: (invoice.winner_invoice_items || []).map(line => ({
        id: line.id,
        itemId: first(line.auction_items)?.id || '',
        hammerPriceCents: Number(line.hammer_price_cents || 0),
        platformFeeCents: Number(line.platform_fee_cents || 0),
        organizerFeeCents: Number(line.organizer_fee_cents || 0),
        bidderFeeCents: Number(line.bidder_fee_cents || 0),
        travelWholesaleCostCents: Number(line.give_holidays_wholesale_cost_cents || 0),
        travelMarkupCents: Number(line.give_holidays_markup_cents || 0),
        fulfillmentStatus: first(line.fulfillments)?.status || null,
      })),
    };
  });
  return buildEventSettlement(auctionId, auction, invoices);
}

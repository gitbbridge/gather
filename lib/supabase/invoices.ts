import type { Auction } from '@/lib/auction';
import { buildWinnerInvoiceDrafts } from '@/lib/invoices';
import { createSupabaseAdminClient } from './admin';

export async function generateWinnerInvoices(auctionId: string, auction: Auction) {
  const client = createSupabaseAdminClient();
  const itemIds = auction.items.map(item => item.id);
  const { data: itemRows, error: itemError } = itemIds.length
    ? await client.from('auction_items').select('id,auction_item_settlements(wholesale_cost_cents,gather_markup_cents)').in('id', itemIds)
    : { data: [], error: null };
  if (itemError) throw itemError;
  const settlements = Object.fromEntries((itemRows || []).map(row => {
    const settlement = Array.isArray(row.auction_item_settlements) ? row.auction_item_settlements[0] : row.auction_item_settlements;
    return [row.id, {
      wholesaleCostCents: Number(settlement?.wholesale_cost_cents || 0),
      markupCents: Number(settlement?.gather_markup_cents || 0),
    }];
  }));
  const drafts = buildWinnerInvoiceDrafts(auction, settlements);
  let totalDueCents = 0;
  for (const draft of drafts) {
    const { data: existing, error: existingError } = await client.from('winner_invoices')
      .select('id,status').eq('auction_id', auctionId).eq('payer_id', draft.payerId).maybeSingle();
    if (existingError) throw existingError;
    if (existing && ['paid', 'partially_refunded', 'refunded'].includes(existing.status)) {
      totalDueCents += draft.totalDueCents;
      continue;
    }
    const invoiceRecord = {
      auction_id: auctionId,
      payer_id: draft.payerId,
      status: 'open',
      currency: 'usd',
      hammer_subtotal_cents: draft.hammerSubtotalCents,
      bidder_platform_fee_cents: draft.bidderPlatformFeeCents,
      give_holidays_wholesale_cost_cents: draft.giveHolidaysWholesaleCostCents,
      give_holidays_markup_cents: draft.giveHolidaysMarkupCents,
      total_due_cents: draft.totalDueCents,
      due_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    };
    const invoiceQuery = existing
      ? client.from('winner_invoices').update(invoiceRecord).eq('id', existing.id)
      : client.from('winner_invoices').insert(invoiceRecord);
    const { data: invoice, error: invoiceError } = await invoiceQuery.select('id').single();
    if (invoiceError) throw invoiceError;
    const lineRecords = draft.lines.map(line => ({
      invoice_id: invoice.id,
      auction_item_id: line.itemId,
      hammer_price_cents: line.hammerPriceCents,
      platform_fee_cents: line.platformFeeCents,
      organizer_fee_cents: line.organizerFeeCents,
      bidder_fee_cents: line.bidderFeeCents,
      give_holidays_wholesale_cost_cents: line.giveHolidaysWholesaleCostCents,
      give_holidays_markup_cents: line.giveHolidaysMarkupCents,
    }));
    const { error: lineError } = await client.from('winner_invoice_items')
      .upsert(lineRecords, { onConflict: 'auction_item_id' });
    if (lineError) throw lineError;
    // A winning bid is not a travel obligation. Stripe's paid webhook creates
    // fulfillment records after the combined invoice is actually paid.
    totalDueCents += draft.totalDueCents;
  }
  return { invoicesCreated: drafts.length, totalDueCents };
}

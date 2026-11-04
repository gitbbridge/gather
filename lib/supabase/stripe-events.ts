import type Stripe from 'stripe';
import { createSupabaseAdminClient } from './admin';
import { dateTime, money, safelySendTrackedTemplateEmail } from '@/lib/email/notifications';

export async function processStripeEvent(event: Stripe.Event) {
  const client = createSupabaseAdminClient();
  const object = event.data.object as { id?: string };
  const base = {
    id: event.id,
    type: event.type,
    object_id: object.id || null,
    connected_account_id: event.account || null,
    livemode: event.livemode,
    stripe_created_at: new Date(event.created * 1000).toISOString(),
    status: 'processing',
  };
  await client.from('stripe_webhook_events').upsert(base, { onConflict: 'id' });
  try {
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.gather_invoice_id;
      if (invoiceId && session.payment_status === 'paid') {
        const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
        const { error } = await client.from('winner_invoices').update({ status: 'paid', stripe_payment_intent_id: paymentIntent || null, paid_at: new Date().toISOString() }).eq('id', invoiceId).eq('stripe_checkout_session_id', session.id);
        if (error) throw error;
        const { error: fulfillmentError } = await client.rpc('activate_paid_fulfillments', { target_invoice_id: invoiceId });
        if (fulfillmentError) throw fulfillmentError;
        const { data: invoice, error: invoiceError } = await client.from('winner_invoices').select(`
          id,payer_id,auction_id,total_due_cents,paid_at,
          auctions(name,organizations(display_name)),
          winner_invoice_items(auction_items(title,source,travel_package_snapshot),fulfillments(id,status))
        `).eq('id', invoiceId).single();
        if (invoiceError) throw invoiceError;
        const auction = Array.isArray(invoice.auctions) ? invoice.auctions[0] : invoice.auctions;
        const organization = Array.isArray(auction?.organizations) ? auction.organizations[0] : auction?.organizations;
        const origin = (process.env.APP_URL || 'https://gatherforgood.bid').replace(/\/$/, '');
        const paidAt = invoice.paid_at || new Date().toISOString();
        await safelySendTrackedTemplateEmail({
          userId: invoice.payer_id,
          auctionId: invoice.auction_id,
          templateId: 'payment-receipt',
          dedupeKey: `payment-receipt-${invoice.id}`,
          values: { auctionName: auction?.name || 'Auction', organizationName: organization?.display_name || 'the nonprofit', receiptNumber: `GTH-${invoice.id.slice(0, 8).toUpperCase()}`, amountPaid: money(Number(invoice.total_due_cents || 0)), paidAt: dateTime(paidAt), paymentMethod: 'Stripe checkout', myWinsUrl: `${origin}/my-wins` },
        });
        for (const line of invoice.winner_invoice_items || []) {
          const item = Array.isArray(line.auction_items) ? line.auction_items[0] : line.auction_items;
          const fulfillment = Array.isArray(line.fulfillments) ? line.fulfillments[0] : line.fulfillments;
          if (item?.source !== 'give_holidays' || !fulfillment) continue;
          const terms = (item.travel_package_snapshot || {}) as Record<string, unknown>;
          await safelySendTrackedTemplateEmail({
            userId: invoice.payer_id,
            auctionId: invoice.auction_id,
            templateId: 'travel-details-needed',
            dedupeKey: `travel-details-needed-${fulfillment.id}`,
            values: { packageTitle: item.title || 'Give Holidays experience', destination: String(terms.destination || 'See package details'), staySummary: [terms.stayLength, terms.occupancy].filter(Boolean).map(String).join(' · ') || 'See package details', expirationDate: String(terms.expirationDate || 'See package terms'), claimUrl: `${origin}/my-wins` },
          });
        }
      }
    } else if (event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.gather_invoice_id;
      if (invoiceId) await client.from('winner_invoices').update({ status: 'open', stripe_checkout_session_id: null }).eq('id', invoiceId);
    }
    await client.from('stripe_webhook_events').update({ status: 'processed', processed_at: new Date().toISOString(), last_error: null }).eq('id', event.id);
  } catch (error) {
    await client.from('stripe_webhook_events').update({ status: 'failed', last_error: error instanceof Error ? error.message.slice(0, 1000) : 'Unknown processing error' }).eq('id', event.id);
    throw error;
  }
}

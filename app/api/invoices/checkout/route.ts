import { z } from 'zod';
import { getAppUser } from '@/lib/auth';
import { paymentAccount } from '@/lib/payments';
import { stripe } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { rateLimitResponse, trustedMutationOrigin } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

const input = z.object({ invoiceId: z.string().uuid() });
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  try {
    if (!trustedMutationOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
    const user = await getAppUser();
    if (!user) return json({ error: 'Sign in to pay your invoice.' }, 401);
    const limited = await rateLimitResponse(request, { bucket: 'invoice-checkout', limit: 8, windowSeconds: 60, identity: user.userId });
    if (limited) return limited;
    const parsed = input.safeParse(await request.json());
    if (!parsed.success) return json({ error: 'Choose an invoice and try again.' }, 400);
    const client = createSupabaseAdminClient();
    const { data: invoice, error } = await client.from('winner_invoices').select(`
      id,status,currency,total_due_cents,auction_id,payer_id,stripe_checkout_session_id,
      auctions(name,organization_id),
      winner_invoice_items(id,hammer_price_cents,platform_fee_cents,bidder_fee_cents,give_holidays_markup_cents,give_holidays_wholesale_cost_cents,auction_items(title,source,travel_package_id))
    `).eq('id', parsed.data.invoiceId).single();
    if (error || !invoice) return json({ error: 'Invoice not found.' }, 404);
    if (invoice.payer_id !== user.userId) return json({ error: 'Access denied.' }, 403);
    if (invoice.status === 'paid') return json({ error: 'This invoice is already paid.' }, 409);
    if (invoice.status !== 'open' || invoice.total_due_cents <= 0) return json({ error: 'This invoice is not ready for payment.' }, 409);
    const auction = Array.isArray(invoice.auctions) ? invoice.auctions[0] : invoice.auctions;
    if (!auction?.organization_id) return json({ error: 'The nonprofit payment account is unavailable.' }, 409);
    const connected = await paymentAccount(auction.organization_id);
    if (!connected || connected.status !== 'ready') return json({ error: 'The nonprofit must finish Stripe setup before winners can pay.' }, 409);

    if (invoice.stripe_checkout_session_id) {
      try {
        const existing = await stripe().checkout.sessions.retrieve(invoice.stripe_checkout_session_id, {}, { stripeAccount: connected.stripeAccountId });
        if (existing.status === 'open' && existing.url) return json({ url: existing.url });
      } catch { /* Create a fresh session if the saved one expired or is unavailable. */ }
    }

    const lines = invoice.winner_invoice_items || [];
    const travelPackageIds = lines.flatMap(line => {
      const item = Array.isArray(line.auction_items) ? line.auction_items[0] : line.auction_items;
      return item?.source === 'give_holidays' && item.travel_package_id ? [item.travel_package_id] : [];
    });
    if (travelPackageIds.length) {
      const { data: packages, error: packageError } = await client.from('travel_packages').select('id,inventory_total,inventory_sold,status').in('id', travelPackageIds);
      if (packageError) throw packageError;
      if ((packages || []).length !== new Set(travelPackageIds).size || (packages || []).some(pkg => pkg.status === 'sold_out' || pkg.inventory_sold >= pkg.inventory_total)) {
        return json({ error: 'A travel package on this invoice is no longer available. Contact the organizer before paying.' }, 409);
      }
    }
    const bidderFeeCents = lines.reduce((sum, line) => sum + Number(line.bidder_fee_cents || 0), 0);
    const applicationFeeCents = lines.reduce((sum, line) => sum + Number(line.platform_fee_cents || 0) + Number(line.give_holidays_markup_cents || 0) + Number(line.give_holidays_wholesale_cost_cents || 0), 0);
    if (applicationFeeCents > invoice.total_due_cents) return json({ error: 'This invoice requires organizer review before payment.' }, 409);
    const lineItems = lines.map(line => {
      const item = Array.isArray(line.auction_items) ? line.auction_items[0] : line.auction_items;
      return { price_data: { currency: invoice.currency, unit_amount: line.hammer_price_cents, product_data: { name: item?.title || 'Winning auction item' } }, quantity: 1 };
    });
    if (bidderFeeCents) lineItems.push({ price_data: { currency: invoice.currency, unit_amount: bidderFeeCents, product_data: { name: 'Gather platform fee' } }, quantity: 1 });
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email,
      line_items: lineItems,
      payment_intent_data: {
        application_fee_amount: applicationFeeCents,
        metadata: { gather_invoice_id: invoice.id, gather_auction_id: invoice.auction_id },
      },
      metadata: { gather_invoice_id: invoice.id, gather_auction_id: invoice.auction_id, gather_payer_id: user.userId },
      success_url: `${origin}/my-wins?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/my-wins?payment=cancelled`,
      custom_text: { submit: { message: 'Stripe processing fees are deducted separately from nonprofit proceeds and are not part of Gather’s 5% platform fee, capped at $100 per item.' } },
    }, {
      stripeAccount: connected.stripeAccountId,
      idempotencyKey: `gather-invoice-${invoice.id}-${Math.floor(Date.now() / 3_600_000)}`,
    });
    await client.from('winner_invoices').update({ stripe_checkout_session_id: session.id }).eq('id', invoice.id);
    if (!session.url) return json({ error: 'Stripe did not return a checkout link.' }, 500);
    return json({ url: session.url });
  } catch (error) {
    console.error('Unable to start winner checkout:', error);
    return json({ error: 'Unable to start secure checkout. Please try again.' }, 500);
  }
}

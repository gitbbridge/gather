import type Stripe from 'stripe';
import { createSupabaseAdminClient } from './admin';

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

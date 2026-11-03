import { env } from 'cloudflare:workers';
import type Stripe from 'stripe';
import { verifiedStripeEvent } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store' },
});

function objectId(event: Stripe.Event) {
  const object = event.data.object as { id?: unknown };
  return typeof object.id === 'string' ? object.id : null;
}

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) return json({ error: 'Missing Stripe signature.' }, 400);
  if (Number(request.headers.get('content-length') || 0) > 1_000_000) {
    return json({ error: 'Webhook payload is too large.' }, 413);
  }

  const payload = await request.text();
  if (payload.length > 1_000_000) return json({ error: 'Webhook payload is too large.' }, 413);
  let event: Stripe.Event;

  try {
    event = await verifiedStripeEvent(payload, signature);
  } catch (error) {
    console.warn('Rejected Stripe webhook:', error instanceof Error ? error.message : 'Invalid event');
    return json({ error: 'Invalid Stripe signature.' }, 400);
  }

  try {
    const database = env.DB;
    if (!database) return json({ error: 'Webhook storage is unavailable.' }, 503);
    const result = await database.prepare(`
      INSERT OR IGNORE INTO stripe_webhook_events
        (id, type, object_id, account_id, livemode, status, stripe_created_at, received_at)
      VALUES (?, ?, ?, ?, ?, 'accepted', ?, ?)
    `).bind(
      event.id,
      event.type,
      objectId(event),
      event.account || null,
      event.livemode ? 1 : 0,
      event.created,
      Math.floor(Date.now() / 1000),
    ).run();

    return json({ received: true, duplicate: result.meta.changes === 0 });
  } catch (error) {
    console.error('Unable to record Stripe webhook:', error);
    return json({ error: 'Unable to record Stripe event.' }, 500);
  }
}

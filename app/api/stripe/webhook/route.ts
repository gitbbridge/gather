import { env } from 'cloudflare:workers';
import type Stripe from 'stripe';
import { verifiedStripeEvent } from '@/lib/stripe';
import { processStripeEvent } from '@/lib/supabase/stripe-events';
import { assertSafeSandboxEnvironment, isSandboxEnvironment } from '@/lib/staging';
import {
  WEBHOOK_PROCESSING_LEASE_SECONDS,
  webhookFailureMessage,
} from '@/lib/stripe-webhook-state';

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
  assertSafeSandboxEnvironment();
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

  if (isSandboxEnvironment() && event.livemode) {
    console.warn('Rejected live-mode Stripe event in the Gather sandbox.');
    return json({ error: 'Live Stripe events are disabled in test mode.' }, 403);
  }

  try {
    const database = env.DB;
    if (!database) return json({ error: 'Webhook storage is unavailable.' }, 503);
    const now = Math.floor(Date.now() / 1000);
    await database.prepare(`
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
      now,
    ).run();

    // Claim new and failed events, or recover work abandoned beyond the lease.
    // The conditional update is the concurrency guard: only one delivery can
    // own processing for a given Stripe event at a time.
    const claim = await database.prepare(`
      UPDATE stripe_webhook_events
      SET status = 'processing', received_at = ?, last_error = NULL
      WHERE id = ? AND (
        status IN ('accepted', 'failed') OR
        (status = 'processing' AND received_at <= ?)
      )
    `).bind(
      now,
      event.id,
      now - WEBHOOK_PROCESSING_LEASE_SECONDS,
    ).run();

    if (claim.meta.changes === 0) return json({ received: true, duplicate: true });

    try {
      await processStripeEvent(event);
      await database.prepare(`
        UPDATE stripe_webhook_events
        SET status = 'processed', processed_at = ?, last_error = NULL
        WHERE id = ? AND status = 'processing'
      `).bind(now, event.id).run();
      return json({ received: true, duplicate: false });
    } catch (error) {
      await database.prepare(`
        UPDATE stripe_webhook_events
        SET status = 'failed', last_error = ?
        WHERE id = ? AND status = 'processing'
      `).bind(webhookFailureMessage(error), event.id).run();
      throw error;
    }
  } catch (error) {
    console.error('Unable to record Stripe webhook:', error);
    return json({ error: 'Unable to record Stripe event.' }, 500);
  }
}

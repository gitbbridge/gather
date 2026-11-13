import Stripe from 'stripe';
import { assertSafeSandboxEnvironment, isSandboxEnvironment } from '@/lib/staging';

let stripeClient: Stripe | null = null;

function requiredSecret(name: 'STRIPE_SECRET_KEY' | 'STRIPE_WEBHOOK_SECRET') {
  const value = process.env[name]?.trim();
  if (!value || value.includes('your_')) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

export function stripe() {
  assertSafeSandboxEnvironment();
  if (isSandboxEnvironment() && !requiredSecret('STRIPE_SECRET_KEY').startsWith('sk_test_')) {
    throw new Error('The Gather sandbox refuses live Stripe credentials.');
  }
  if (!stripeClient) {
    stripeClient = new Stripe(requiredSecret('STRIPE_SECRET_KEY'), {
      httpClient: Stripe.createFetchHttpClient(),
      maxNetworkRetries: 2,
    });
  }
  return stripeClient;
}

export function stripeLivemode() {
  return requiredSecret('STRIPE_SECRET_KEY').startsWith('sk_live_');
}

export async function verifiedStripeEvent(payload: string, signature: string) {
  return stripe().webhooks.constructEventAsync(
    payload,
    signature,
    requiredSecret('STRIPE_WEBHOOK_SECRET'),
    undefined,
    Stripe.createSubtleCryptoProvider(),
  );
}

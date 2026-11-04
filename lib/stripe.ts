import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

function requiredSecret(name: 'STRIPE_SECRET_KEY' | 'STRIPE_WEBHOOK_SECRET') {
  const value = process.env[name]?.trim();
  if (!value || value.includes('your_')) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

export function stripe() {
  if (!stripeClient) {
    stripeClient = new Stripe(requiredSecret('STRIPE_SECRET_KEY'), {
      httpClient: Stripe.createFetchHttpClient(),
      maxNetworkRetries: 2,
    });
  }
  return stripeClient;
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

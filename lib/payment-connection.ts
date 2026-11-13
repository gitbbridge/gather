import type Stripe from 'stripe';

export type PaymentConnectionStatus = 'not_connected' | 'pending' | 'ready' | 'restricted';

export type PaymentConnection = {
  status: PaymentConnectionStatus;
  cardPaymentsStatus: string;
  payoutsStatus: string;
  livemode: boolean;
};

export function stripeConnection(account: Stripe.Account, livemode: boolean): PaymentConnection {
  const disabledReason = account.requirements?.disabled_reason || null;
  const cardPaymentsStatus = account.charges_enabled ? 'active' : disabledReason || 'pending';
  const payoutsStatus = account.payouts_enabled ? 'active' : disabledReason || 'pending';
  const status: PaymentConnectionStatus = account.charges_enabled && account.payouts_enabled
    ? 'ready'
    : disabledReason
      ? 'restricted'
      : 'pending';
  return { status, cardPaymentsStatus, payoutsStatus, livemode };
}

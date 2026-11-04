import type Stripe from 'stripe';
import { database } from '@/lib/nonprofits';

export type PaymentConnectionStatus = 'not_connected' | 'pending' | 'ready' | 'restricted';

export type PaymentConnection = {
  status: PaymentConnectionStatus;
  cardPaymentsStatus: string;
  payoutsStatus: string;
  livemode: boolean;
};

type PaymentAccountRow = PaymentConnection & {
  nonprofitId: string;
  stripeAccountId: string;
  updatedAt: number;
};

const notConnected: PaymentConnection = {
  status: 'not_connected',
  cardPaymentsStatus: 'inactive',
  payoutsStatus: 'inactive',
  livemode: false,
};

export async function paymentAccount(nonprofitId: string) {
  return database().prepare(`
    SELECT nonprofit_id AS nonprofitId, stripe_account_id AS stripeAccountId,
      status, card_payments_status AS cardPaymentsStatus,
      payouts_status AS payoutsStatus, livemode, updated_at AS updatedAt
    FROM nonprofit_payment_accounts WHERE nonprofit_id=?
  `).bind(nonprofitId).first<PaymentAccountRow>();
}

export async function paymentConnection(nonprofitId: string): Promise<PaymentConnection> {
  const row = await paymentAccount(nonprofitId);
  return row ? publicConnection(row) : notConnected;
}

export function stripeConnection(account: Stripe.V2.Core.Account): PaymentConnection {
  const cardPaymentsStatus = account.configuration?.merchant?.capabilities?.card_payments?.status || 'pending';
  const payoutsStatus = account.configuration?.merchant?.capabilities?.stripe_balance?.payouts?.status || 'pending';
  const rejected = ['rejected', 'restricted', 'unsupported'];
  const status: PaymentConnectionStatus = cardPaymentsStatus === 'active' && payoutsStatus === 'active'
    ? 'ready'
    : rejected.includes(cardPaymentsStatus) || rejected.includes(payoutsStatus)
      ? 'restricted'
      : 'pending';
  return { status, cardPaymentsStatus, payoutsStatus, livemode: account.livemode };
}

export async function savePaymentAccount(nonprofitId: string, stripeAccountId: string, connection: PaymentConnection) {
  await database().prepare(`
    INSERT INTO nonprofit_payment_accounts
      (nonprofit_id, stripe_account_id, status, card_payments_status, payouts_status, livemode, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(nonprofit_id) DO UPDATE SET
      stripe_account_id=excluded.stripe_account_id,
      status=excluded.status,
      card_payments_status=excluded.card_payments_status,
      payouts_status=excluded.payouts_status,
      livemode=excluded.livemode,
      updated_at=excluded.updated_at
  `).bind(
    nonprofitId,
    stripeAccountId,
    connection.status,
    connection.cardPaymentsStatus,
    connection.payoutsStatus,
    connection.livemode ? 1 : 0,
    Date.now(),
  ).run();
}

function publicConnection(row: PaymentAccountRow): PaymentConnection {
  return {
    status: row.status,
    cardPaymentsStatus: row.cardPaymentsStatus,
    payoutsStatus: row.payoutsStatus,
    livemode: Boolean(row.livemode),
  };
}

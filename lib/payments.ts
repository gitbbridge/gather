import { database } from '@/lib/nonprofits';
import { type PaymentConnection } from '@/lib/payment-connection';

export { stripeConnection } from '@/lib/payment-connection';
export type { PaymentConnection, PaymentConnectionStatus } from '@/lib/payment-connection';

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

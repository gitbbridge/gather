import test from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import { stripeConnection } from '../lib/payment-connection.ts';

function account(overrides: Partial<Stripe.Account> = {}): Stripe.Account {
  return {
    id: 'acct_test',
    object: 'account',
    charges_enabled: false,
    payouts_enabled: false,
    requirements: {
      alternatives: [],
      current_deadline: null,
      currently_due: [],
      disabled_reason: null,
      errors: [],
      eventually_due: [],
      past_due: [],
      pending_verification: [],
    },
    ...overrides,
  } as Stripe.Account;
}

test('Stripe connection is ready only when charges and payouts are enabled', () => {
  assert.deepEqual(stripeConnection(account({ charges_enabled: true, payouts_enabled: true }), false), {
    status: 'ready',
    cardPaymentsStatus: 'active',
    payoutsStatus: 'active',
    livemode: false,
  });
});

test('Stripe connection remains pending while onboarding requirements are incomplete', () => {
  assert.deepEqual(stripeConnection(account(), false), {
    status: 'pending',
    cardPaymentsStatus: 'pending',
    payoutsStatus: 'pending',
    livemode: false,
  });
});

test('Stripe connection exposes a disabled reason as restricted', () => {
  const requirements = {
    ...account().requirements!,
    disabled_reason: 'requirements.past_due' as const,
  };
  assert.deepEqual(stripeConnection(account({ requirements }), true), {
    status: 'restricted',
    cardPaymentsStatus: 'requirements.past_due',
    payoutsStatus: 'requirements.past_due',
    livemode: true,
  });
});

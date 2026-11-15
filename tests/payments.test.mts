import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAuctionPayment } from '../lib/payment-fees.ts';

test('Gather platform fee is always zero regardless of legacy allocation input', () => {
  for (const allocation of [0, 40, 100]) {
    const payment = calculateAuctionPayment(500_000, allocation);
    assert.equal(payment.platformFeeCents, 0);
    assert.equal(payment.organizerFeeCents, 0);
    assert.equal(payment.bidderFeeCents, 0);
    assert.equal(payment.bidderTotalCents, 500_000);
    assert.equal(payment.organizerGrossCents, 500_000);
    assert.equal(payment.applicationFeeCents, 0);
  }
});

test('Give Holidays economics remain separate and are withheld from proceeds', () => {
  const payment = calculateAuctionPayment(12_345, 40, 1_000, 5_000);
  assert.equal(payment.platformFeeCents, 0);
  assert.equal(payment.bidderTotalCents, 12_345);
  assert.equal(payment.organizerGrossCents, 6_345);
  assert.equal(payment.applicationFeeCents, 6_000);
});

test('travel settlement cannot exceed the amount collected', () => {
  assert.throws(() => calculateAuctionPayment(10_000, 100, 2_000, 9_000), /does not cover/);
});

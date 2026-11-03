import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAuctionPayment } from '../lib/payment-fees.ts';

test('organizer-paid commission comes from nonprofit proceeds', () => {
  assert.deepEqual(calculateAuctionPayment(10_000, 100), {
    hammerPriceCents: 10_000,
    platformFeeCents: 500,
    organizerFeeCents: 500,
    bidderFeeCents: 0,
    giveHolidaysMarkupCents: 0,
    bidderTotalCents: 10_000,
    organizerGrossCents: 9_500,
    applicationFeeCents: 500,
  });
});

test('bidder-paid commission is added to checkout', () => {
  const payment = calculateAuctionPayment(10_000, 0);
  assert.equal(payment.bidderTotalCents, 10_500);
  assert.equal(payment.organizerGrossCents, 10_000);
  assert.equal(payment.applicationFeeCents, 500);
});

test('split commission and Give Holidays markup stay separately auditable', () => {
  const payment = calculateAuctionPayment(12_345, 40, 25_000);
  assert.equal(payment.platformFeeCents, 617);
  assert.equal(payment.organizerFeeCents, 247);
  assert.equal(payment.bidderFeeCents, 370);
  assert.equal(payment.giveHolidaysMarkupCents, 25_000);
  assert.equal(payment.bidderTotalCents, 37_715);
  assert.equal(payment.organizerGrossCents, 12_098);
  assert.equal(payment.applicationFeeCents, 25_617);
  assert.equal(payment.organizerFeeCents + payment.bidderFeeCents, payment.platformFeeCents);
});

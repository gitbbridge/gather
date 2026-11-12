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
    giveHolidaysWholesaleCostCents: 0,
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

test('platform fee is capped at $100 per item for every allocation', () => {
  const organizerPaid = calculateAuctionPayment(500_000, 100);
  assert.equal(organizerPaid.platformFeeCents, 10_000);
  assert.equal(organizerPaid.organizerFeeCents, 10_000);
  assert.equal(organizerPaid.bidderFeeCents, 0);
  assert.equal(organizerPaid.organizerGrossCents, 490_000);

  const bidderPaid = calculateAuctionPayment(500_000, 0);
  assert.equal(bidderPaid.platformFeeCents, 10_000);
  assert.equal(bidderPaid.bidderFeeCents, 10_000);
  assert.equal(bidderPaid.bidderTotalCents, 510_000);

  const split = calculateAuctionPayment(500_000, 40);
  assert.equal(split.platformFeeCents, 10_000);
  assert.equal(split.organizerFeeCents, 4_000);
  assert.equal(split.bidderFeeCents, 6_000);
});

test('platform fee matches the published $200 and $5,000 examples', () => {
  assert.equal(calculateAuctionPayment(20_000, 100).platformFeeCents, 1_000);
  assert.equal(calculateAuctionPayment(500_000, 100).platformFeeCents, 10_000);
});

test('travel cost and markup are withheld from proceeds rather than added to bidder checkout', () => {
  const payment = calculateAuctionPayment(12_345, 40, 1_000, 5_000);
  assert.equal(payment.platformFeeCents, 617);
  assert.equal(payment.organizerFeeCents, 247);
  assert.equal(payment.bidderFeeCents, 370);
  assert.equal(payment.giveHolidaysMarkupCents, 1_000);
  assert.equal(payment.giveHolidaysWholesaleCostCents, 5_000);
  assert.equal(payment.bidderTotalCents, 12_715);
  assert.equal(payment.organizerGrossCents, 6_098);
  assert.equal(payment.applicationFeeCents, 6_617);
  assert.equal(payment.organizerFeeCents + payment.bidderFeeCents, payment.platformFeeCents);
});

test('travel settlement cannot exceed the amount collected', () => {
  assert.throws(() => calculateAuctionPayment(10_000, 100, 2_000, 9_000), /does not cover/);
});

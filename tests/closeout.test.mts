import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuction } from '../lib/auction.ts';
import { buildCloseout, followupMessage } from '../lib/closeout.ts';

test('closeout keeps bidders separate from winners until an item closes', () => {
  const auction = createAuction();
  auction.items[0].bids.push({ user: 'bidder-1', max: 30000, at: 10 });
  auction.items[0].leader = 'bidder-1';
  auction.items[0].price = 20000;
  const open = buildCloseout(auction, [{ userId: 'bidder-1', name: 'Avery Reed', email: 'avery@example.com' }], [], auction.items[0].ends - 1);
  assert.deepEqual(open.participants[0].activity, ['Bidder only']);
  assert.equal(open.auctionRaised, 0);

  const closed = buildCloseout(auction, [{ userId: 'bidder-1', name: 'Avery Reed', email: 'avery@example.com' }], [], auction.items[0].ends);
  assert.deepEqual(closed.participants[0].activity, ['Winner']);
  assert.equal(closed.auctionRaised, 20000);
});

test('donations, buy-now orders, and winning bids remain distinct commitments', () => {
  const auction = createAuction();
  auction.items[0].bids.push({ user: 'supporter-1', max: 30000, at: 10 });
  auction.items[0].leader = 'supporter-1';
  auction.items[0].price = 20000;
  auction.items[0].ends = 20;
  auction.items[2].leader = 'supporter-1';
  auction.items[2].price = 30000;
  auction.items[2].sold = true;
  auction.orders.push({ id: 'order-1', user: 'supporter-1', item: auction.items[2].title, amount: 30000, at: 12 });
  auction.donations.push({ user: 'supporter-1', amount: 50000, at: 13 });

  const result = buildCloseout(auction, [{ userId: 'supporter-1', name: 'Sarah Williams', email: 'sarah@example.com' }], [], 21);
  const person = result.participants[0];
  assert.equal(person.winningBidTotal, 20000);
  assert.equal(person.buyNowTotal, 30000);
  assert.equal(person.donationTotal, 50000);
  assert.equal(person.totalCommitment, 100000);
  assert.match(followupMessage(person, auction.organization), /won .* and also made a donation/i);
  assert.match(followupMessage(person, auction.organization), /test closeout/i);
});

test('closeout preserves operational statuses without treating them as payment', () => {
  const auction = createAuction();
  auction.donations.push({ user: 'donor-1', amount: 2500, at: 5 });
  const result = buildCloseout(
    auction,
    [{ userId: 'donor-1', name: 'Maria Lopez', email: 'maria@example.com' }],
    [{ userId: 'donor-1', pickupStatus: 'not_applicable', followupStatus: 'complete' }],
  );
  assert.equal(result.participants[0].paymentStatus, 'not_collected_test_mode');
  assert.equal(result.participants[0].followupStatus, 'complete');
  assert.equal(result.outstanding, 0);
});

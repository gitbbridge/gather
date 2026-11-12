import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuction } from '../lib/auction.ts';
import { buildWinnerInvoiceDrafts } from '../lib/invoices.ts';

test('winner invoice combines closed items and adds only the bidder fee to checkout', () => {
  const auction = createAuction('Auction', 'Nonprofit', { starts: 1, ends: 2, organizerPercent: 40, items: [
    { title: 'Dinner', value: 10_000 },
    { title: 'Maui getaway', value: 20_000, source: 'give-holidays', packageCode: 'MAUI' },
  ] });
  auction.items[0].leader = 'winner'; auction.items[0].price = 10_000; auction.items[0].bids = [{ user: 'winner', max: 10_000, at: 1 }];
  auction.items[1].leader = 'winner'; auction.items[1].price = 20_000; auction.items[1].bids = [{ user: 'winner', max: 20_000, at: 1 }];
  const invoices = buildWinnerInvoiceDrafts(auction, { [auction.items[1].id]: { wholesaleCostCents: 5_000, markupCents: 1_000 } }, 3);
  assert.equal(invoices.length, 1);
  assert.equal(invoices[0].hammerSubtotalCents, 30_000);
  assert.equal(invoices[0].bidderPlatformFeeCents, 900);
  assert.equal(invoices[0].totalDueCents, 30_900);
  assert.equal(invoices[0].giveHolidaysWholesaleCostCents, 5_000);
  assert.equal(invoices[0].giveHolidaysMarkupCents, 1_000);
  assert.equal(invoices[0].applicationFeeCents, 7_500);
  assert.equal(invoices[0].organizerGrossCents, 23_400);
});

test('invoice generation refuses an auction that is still open', () => {
  const auction = createAuction('Auction', 'Nonprofit', { starts: 1, ends: 100 });
  assert.throws(() => buildWinnerInvoiceDrafts(auction, {}, 50), /after every auction item closes/);
});

test('the $100 cap is applied to each item, not the combined invoice', () => {
  const items = Array.from({ length: 2 }, (_, index) => ({
    title: `Premium item ${index + 1}`,
    value: 500_000,
  }));
  const auction = createAuction('Auction', 'Nonprofit', { starts: 1, ends: 2, organizerPercent: 0, items });
  for (const item of auction.items) {
    item.leader = 'winner';
    item.price = 500_000;
    item.bids = [{ user: 'winner', max: 500_000, at: 1 }];
  }
  const [invoice] = buildWinnerInvoiceDrafts(auction, {}, 3);
  assert.equal(invoice.hammerSubtotalCents, 1_000_000);
  assert.equal(invoice.bidderPlatformFeeCents, 20_000);
  assert.equal(invoice.totalDueCents, 1_020_000);
});

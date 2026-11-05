import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuction } from '../lib/auction.ts';
import { buildEventSettlement, settlementCsv, type SettlementInvoice } from '../lib/settlement.ts';

function closedAuction() {
  const auction = createAuction('Spring Auction', 'Community Fund', { starts: 1, ends: 2, organizerPercent: 40, items: [
    { title: 'Chef dinner', value: 20_000 },
    { title: 'Tuscany', value: 50_000, source: 'give-holidays', packageCode: 'TUS' },
    { title: 'Unsold art', value: 10_000 },
  ] });
  return auction;
}

test('settlement keeps gross, collected, refunds, fees, travel costs, and net distinct', () => {
  const auction = closedAuction();
  const invoices: SettlementInvoice[] = [{
    id: 'invoice-1', payerId: 'winner-1', payerName: 'Avery Reed', payerEmail: 'avery@example.org',
    status: 'partially_refunded', lastPaymentStatus: 'partially_refunded', totalDueCents: 31_500,
    processingFeeCents: 945, stripePaymentIntentId: 'pi_123', receiptNumber: 'GTH-123', refundCents: 5_000,
    lines: [
      { id: 'line-1', itemId: auction.items[0].id, hammerPriceCents: 10_000, platformFeeCents: 500, organizerFeeCents: 200, bidderFeeCents: 300, travelWholesaleCostCents: 0, travelMarkupCents: 0, fulfillmentStatus: 'ready' },
      { id: 'line-2', itemId: auction.items[1].id, hammerPriceCents: 20_000, platformFeeCents: 1_000, organizerFeeCents: 400, bidderFeeCents: 600, travelWholesaleCostCents: 5_000, travelMarkupCents: 1_000, fulfillmentStatus: 'paid_details_needed' },
    ],
  }];
  const result = buildEventSettlement('auction-1', auction, invoices, '2026-11-04T12:00:00.000Z');
  assert.equal(result.summary.grossAuctionProceedsCents, 30_000);
  assert.equal(result.summary.collectedPaymentsCents, 26_500);
  assert.equal(result.summary.refundsCents, 5_000);
  assert.equal(result.summary.platformCommissionCents, 1_500);
  assert.equal(result.summary.bidderCommissionCents, 900);
  assert.equal(result.summary.nonprofitCommissionCents, 600);
  assert.equal(result.summary.processingFeesCents, 945);
  assert.equal(result.summary.travelSupplierCostsCents, 5_000);
  assert.equal(result.summary.travelMarkupCents, 1_000);
  assert.equal(result.summary.netProceedsCents, 17_455);
  assert.equal(result.summary.soldItems, 2);
  assert.equal(result.summary.sellThroughPercent, 66.7);
  assert.equal(result.ledger.reduce((sum, row) => sum + row.netProceedsCents, 0), result.summary.netProceedsCents);
  assert.equal(result.ledger[0].commissionConfiguration, 'Split');
  assert.equal(result.ledger[0].paymentStatus, 'Partially Refunded');
  assert.equal(result.ledger[2].winningBidCents, 0);
});

test('failed and unpaid winning bids are not reported as collected cash', () => {
  const auction = closedAuction();
  const invoices: SettlementInvoice[] = [{ id: 'failed', payerId: 'winner', payerName: 'Winner', payerEmail: 'winner@example.org', status: 'open', lastPaymentStatus: 'failed', totalDueCents: 10_300, processingFeeCents: 0, refundCents: 0, lines: [{ id: 'line', itemId: auction.items[0].id, hammerPriceCents: 10_000, platformFeeCents: 500, organizerFeeCents: 200, bidderFeeCents: 300, travelWholesaleCostCents: 0, travelMarkupCents: 0 }] }];
  const result = buildEventSettlement('auction-1', auction, invoices);
  assert.equal(result.summary.collectedPaymentsCents, 0);
  assert.equal(result.summary.failedPaymentsCents, 10_000);
  assert.equal(result.summary.outstandingWinningBidsCents, 0);
});

test('final settlement CSV uses numeric money fields and matches dashboard totals', () => {
  const result = buildEventSettlement('auction-1', closedAuction(), []);
  const output = settlementCsv(result);
  assert.match(output, /"Gross Auction Proceeds","0"/);
  assert.match(output, /"Net Nonprofit Proceeds","0"/);
  assert.doesNotMatch(output, /\$0\.00/);
});

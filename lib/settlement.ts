import type { Auction } from './auction';

export type SettlementPaymentStatus = 'Paid' | 'Unpaid' | 'Failed' | 'Refunded' | 'Partially Refunded';
export type SettlementFulfillmentStatus = 'Not Required' | 'Pending' | 'Ready to Release' | 'Released' | 'Completed';

export type SettlementInvoice = {
  id: string;
  payerId: string;
  payerName: string;
  payerEmail: string;
  status: string;
  lastPaymentStatus?: string | null;
  totalDueCents: number;
  processingFeeCents: number;
  stripePaymentIntentId?: string | null;
  receiptNumber?: string | null;
  paidAt?: string | null;
  refundCents: number;
  lines: SettlementInvoiceLine[];
};

export type SettlementInvoiceLine = {
  id: string;
  itemId: string;
  hammerPriceCents: number;
  platformFeeCents: number;
  organizerFeeCents: number;
  bidderFeeCents: number;
  travelWholesaleCostCents: number;
  travelMarkupCents: number;
  fulfillmentStatus?: string | null;
};

export type SettlementLedgerRow = {
  itemId: string;
  itemName: string;
  category: string;
  source: 'custom' | 'give_holidays';
  bidderId: string;
  supporterId?: string;
  bidderName: string;
  bidderEmail: string;
  winningBidCents: number;
  commissionConfiguration: 'Nonprofit Pays' | 'Bidder Pays' | 'Split';
  bidderCommissionCents: number;
  nonprofitCommissionCents: number;
  processingFeeCents: number;
  travelSupplierCostCents: number;
  travelMarkupCents: number;
  refundCents: number;
  totalPaidByBidderCents: number;
  paymentStatus: SettlementPaymentStatus;
  fulfillmentStatus: SettlementFulfillmentStatus;
  transactionId: string;
  receiptId: string;
  invoiceId: string;
  netProceedsCents: number;
};

export type SettlementSummary = {
  grossAuctionProceedsCents: number;
  collectedPaymentsCents: number;
  outstandingWinningBidsCents: number;
  failedPaymentsCents: number;
  refundsCents: number;
  platformCommissionCents: number;
  bidderCommissionCents: number;
  nonprofitCommissionCents: number;
  processingFeesCents: number;
  travelSupplierCostsCents: number;
  travelMarkupCents: number;
  netProceedsCents: number;
  listedItems: number;
  soldItems: number;
  paidWinners: number;
  averageWinningBidCents: number;
  sellThroughPercent: number;
};

export type EventSettlement = {
  auction: { id: string; name: string; organization: string; organizationId?: string; organizerPercent: number };
  summary: SettlementSummary;
  ledger: SettlementLedgerRow[];
  generatedAt: string;
};

function paymentStatus(invoice: SettlementInvoice): SettlementPaymentStatus {
  if (invoice.status === 'refunded' || invoice.lastPaymentStatus === 'refunded') return 'Refunded';
  if (invoice.status === 'partially_refunded' || invoice.lastPaymentStatus === 'partially_refunded') return 'Partially Refunded';
  if (invoice.status === 'paid' || invoice.lastPaymentStatus === 'paid') return 'Paid';
  if (invoice.status === 'failed' || invoice.lastPaymentStatus === 'failed') return 'Failed';
  return 'Unpaid';
}

function fulfillmentStatus(value?: string | null): SettlementFulfillmentStatus {
  if (!value) return 'Not Required';
  if (['pending', 'won_unpaid', 'paid_details_needed', 'traveler_details_submitted', 'dates_requested', 'booking_in_progress'].includes(value)) return 'Pending';
  if (value === 'ready') return 'Ready to Release';
  if (['in_progress', 'confirmed'].includes(value)) return 'Released';
  if (['fulfilled', 'completed'].includes(value)) return 'Completed';
  return 'Pending';
}

function allocation(total: number, weights: number[]) {
  if (!weights.length || total <= 0) return weights.map(() => 0);
  const weightTotal = weights.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (!weightTotal) return weights.map(() => 0);
  let assigned = 0;
  return weights.map((weight, index) => {
    const value = index === weights.length - 1 ? total - assigned : Math.floor(total * Math.max(0, weight) / weightTotal);
    assigned += value;
    return value;
  });
}

function commissionLabel(organizerPercent: number): SettlementLedgerRow['commissionConfiguration'] {
  return organizerPercent === 100 ? 'Nonprofit Pays' : organizerPercent === 0 ? 'Bidder Pays' : 'Split';
}

export function buildEventSettlement(auctionId: string, auction: Auction, invoices: SettlementInvoice[], generatedAt = new Date().toISOString()): EventSettlement {
  const byItem = new Map<string, { invoice: SettlementInvoice; line: SettlementInvoiceLine; processing: number; refund: number }>();
  for (const invoice of invoices) {
    const weights = invoice.lines.map(line => line.hammerPriceCents + line.bidderFeeCents);
    const processing = allocation(invoice.processingFeeCents, weights);
    const refunds = allocation(invoice.refundCents, weights);
    invoice.lines.forEach((line, index) => byItem.set(line.itemId, { invoice, line, processing: processing[index], refund: refunds[index] }));
  }

  const ledger: SettlementLedgerRow[] = auction.items.map(item => {
    const match = byItem.get(item.id);
    if (!match) return {
      itemId: item.id, itemName: item.title, category: item.category, source: item.source === 'give-holidays' ? 'give_holidays' : 'custom',
      bidderId: '', bidderName: '', bidderEmail: '', winningBidCents: 0,
      commissionConfiguration: commissionLabel(auction.feePolicy.organizerPercent), bidderCommissionCents: 0,
      nonprofitCommissionCents: 0, processingFeeCents: 0, travelSupplierCostCents: 0, travelMarkupCents: 0,
      refundCents: 0, totalPaidByBidderCents: 0, paymentStatus: 'Unpaid' as const,
      fulfillmentStatus: 'Not Required' as const, transactionId: '', receiptId: '', invoiceId: '', netProceedsCents: 0,
    };
    const { invoice, line, processing, refund } = match;
    const status = paymentStatus(invoice);
    const paid = ['Paid', 'Partially Refunded', 'Refunded'].includes(status);
    return {
      itemId: item.id, itemName: item.title, category: item.category, source: item.source === 'give-holidays' ? 'give_holidays' : 'custom',
      bidderId: invoice.payerId, bidderName: invoice.payerName, bidderEmail: invoice.payerEmail,
      winningBidCents: line.hammerPriceCents, commissionConfiguration: commissionLabel(auction.feePolicy.organizerPercent),
      bidderCommissionCents: line.bidderFeeCents, nonprofitCommissionCents: line.organizerFeeCents,
      processingFeeCents: processing, travelSupplierCostCents: line.travelWholesaleCostCents,
      travelMarkupCents: line.travelMarkupCents, refundCents: refund,
      totalPaidByBidderCents: paid ? line.hammerPriceCents + line.bidderFeeCents : 0,
      paymentStatus: status, fulfillmentStatus: fulfillmentStatus(line.fulfillmentStatus),
      transactionId: invoice.stripePaymentIntentId || '', receiptId: invoice.receiptNumber || '', invoiceId: invoice.id,
      netProceedsCents: line.hammerPriceCents - line.organizerFeeCents - processing - refund - line.travelWholesaleCostCents - line.travelMarkupCents,
    };
  });

  const sold = ledger.filter(row => row.winningBidCents > 0);
  const paidInvoiceIds = new Set(invoices.filter(invoice => ['Paid', 'Partially Refunded', 'Refunded'].includes(paymentStatus(invoice))).map(invoice => invoice.id));
  const sum = (key: keyof SettlementLedgerRow) => ledger.reduce((total, row) => total + Number(row[key] || 0), 0);
  const gross = sum('winningBidCents');
  const collected = invoices.reduce((total, invoice) => ['Paid', 'Partially Refunded', 'Refunded'].includes(paymentStatus(invoice)) ? total + Math.max(0, invoice.totalDueCents - invoice.refundCents) : total, 0);
  const outstanding = ledger.filter(row => row.paymentStatus === 'Unpaid').reduce((total, row) => total + row.winningBidCents, 0);
  const failed = ledger.filter(row => row.paymentStatus === 'Failed').reduce((total, row) => total + row.winningBidCents, 0);
  const summary: SettlementSummary = {
    grossAuctionProceedsCents: gross,
    collectedPaymentsCents: collected,
    outstandingWinningBidsCents: outstanding,
    failedPaymentsCents: failed,
    refundsCents: sum('refundCents'),
    platformCommissionCents: sum('bidderCommissionCents') + sum('nonprofitCommissionCents'),
    bidderCommissionCents: sum('bidderCommissionCents'),
    nonprofitCommissionCents: sum('nonprofitCommissionCents'),
    processingFeesCents: sum('processingFeeCents'),
    travelSupplierCostsCents: sum('travelSupplierCostCents'),
    travelMarkupCents: sum('travelMarkupCents'),
    netProceedsCents: sum('netProceedsCents'),
    listedItems: ledger.length,
    soldItems: sold.length,
    paidWinners: paidInvoiceIds.size,
    averageWinningBidCents: sold.length ? Math.round(gross / sold.length) : 0,
    sellThroughPercent: ledger.length ? Math.round(sold.length / ledger.length * 1000) / 10 : 0,
  };
  return { auction: { id: auctionId, name: auction.name, organization: auction.organization, organizerPercent: auction.feePolicy.organizerPercent }, summary, ledger, generatedAt };
}

export function settlementCsv(settlement: EventSettlement) {
  const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const rows: (string | number)[][] = [
    ['Event', settlement.auction.name], ['Organization', settlement.auction.organization], ['Generated At', settlement.generatedAt], [],
    ['Summary Metric', 'Amount / Value'],
    ['Gross Auction Proceeds', settlement.summary.grossAuctionProceedsCents / 100],
    ['Collected Payments', settlement.summary.collectedPaymentsCents / 100],
    ['Outstanding Winning Bids', settlement.summary.outstandingWinningBidsCents / 100],
    ['Failed Payments', settlement.summary.failedPaymentsCents / 100], ['Refunds', settlement.summary.refundsCents / 100],
    ['Platform Commission', settlement.summary.platformCommissionCents / 100], ['Bidder-Paid Commission', settlement.summary.bidderCommissionCents / 100],
    ['Nonprofit-Paid Commission', settlement.summary.nonprofitCommissionCents / 100], ['Processing Fees', settlement.summary.processingFeesCents / 100],
    ['Travel Supplier Costs', settlement.summary.travelSupplierCostsCents / 100], ['Give Holidays Markup', settlement.summary.travelMarkupCents / 100],
    ['Net Nonprofit Proceeds', settlement.summary.netProceedsCents / 100], ['Listed Items', settlement.summary.listedItems],
    ['Sold Items', settlement.summary.soldItems], ['Paid Winners', settlement.summary.paidWinners],
    ['Average Winning Bid', settlement.summary.averageWinningBidCents / 100], ['Sell-Through Percent', settlement.summary.sellThroughPercent], [],
    ['Item Name','Category','Winning Bidder','Bidder Email','Winning Bid','Commission Configuration','Bidder Commission','Nonprofit Commission','Processing Fee','Travel Supplier Cost','Give Holidays Markup','Refund','Total Paid By Bidder','Payment Status','Fulfillment Status','Transaction ID','Receipt ID','Net Nonprofit Proceeds'],
    ...settlement.ledger.map(row => [row.itemName,row.category,row.bidderName,row.bidderEmail,row.winningBidCents/100,row.commissionConfiguration,row.bidderCommissionCents/100,row.nonprofitCommissionCents/100,row.processingFeeCents/100,row.travelSupplierCostCents/100,row.travelMarkupCents/100,row.refundCents/100,row.totalPaidByBidderCents/100,row.paymentStatus,row.fulfillmentStatus,row.transactionId,row.receiptId,row.netProceedsCents/100]),
  ];
  return rows.map(row => row.map(quote).join(',')).join('\r\n');
}

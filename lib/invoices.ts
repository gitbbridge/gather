import type { Auction } from './auction.ts';
import { calculateAuctionPayment } from './payment-fees.ts';

export type TravelSettlement = { wholesaleCostCents: number; markupCents: number };
export type WinnerInvoiceLine = ReturnType<typeof calculateAuctionPayment> & {
  itemId: string;
  title: string;
  source: 'custom' | 'give-holidays';
};
export type WinnerInvoiceDraft = {
  payerId: string;
  lines: WinnerInvoiceLine[];
  hammerSubtotalCents: number;
  bidderPlatformFeeCents: number;
  giveHolidaysWholesaleCostCents: number;
  giveHolidaysMarkupCents: number;
  totalDueCents: number;
  applicationFeeCents: number;
  organizerGrossCents: number;
};

export function buildWinnerInvoiceDrafts(auction: Auction, settlements: Record<string, TravelSettlement>, now = Date.now()): WinnerInvoiceDraft[] {
  if (auction.items.some(item => !item.sold && item.ends > now)) throw new Error('Winner invoices can only be created after every auction item closes.');
  const byPayer = new Map<string, WinnerInvoiceLine[]>();
  for (const item of auction.items) {
    if (!item.leader || (!item.sold && item.ends > now)) continue;
    const settlement = settlements[item.id] || { wholesaleCostCents: 0, markupCents: 0 };
    const payment = calculateAuctionPayment(item.price, auction.feePolicy.organizerPercent, settlement.markupCents, settlement.wholesaleCostCents);
    const line: WinnerInvoiceLine = { ...payment, itemId: item.id, title: item.title, source: item.source || 'custom' };
    byPayer.set(item.leader, [...(byPayer.get(item.leader) || []), line]);
  }
  return [...byPayer.entries()].map(([payerId, lines]) => ({
    payerId,
    lines,
    hammerSubtotalCents: lines.reduce((sum, line) => sum + line.hammerPriceCents, 0),
    bidderPlatformFeeCents: lines.reduce((sum, line) => sum + line.bidderFeeCents, 0),
    giveHolidaysWholesaleCostCents: lines.reduce((sum, line) => sum + line.giveHolidaysWholesaleCostCents, 0),
    giveHolidaysMarkupCents: lines.reduce((sum, line) => sum + line.giveHolidaysMarkupCents, 0),
    totalDueCents: lines.reduce((sum, line) => sum + line.bidderTotalCents, 0),
    applicationFeeCents: lines.reduce((sum, line) => sum + line.applicationFeeCents, 0),
    organizerGrossCents: lines.reduce((sum, line) => sum + line.organizerGrossCents, 0),
  }));
}

export const AUCTION_PLATFORM_FEE_RATE = 0;
export const AUCTION_PLATFORM_FEE_CAP_CENTS = 0;

export function calculateAuctionPayment(hammerPriceCents: number, _organizerSharePercent = 0, giveHolidaysMarkupCents = 0, giveHolidaysWholesaleCostCents = 0) {
  if (!Number.isInteger(hammerPriceCents) || hammerPriceCents < 0) throw new Error('Invalid hammer price.');
  if (!Number.isInteger(giveHolidaysMarkupCents) || giveHolidaysMarkupCents < 0) throw new Error('Invalid package markup.');
  if (!Number.isInteger(giveHolidaysWholesaleCostCents) || giveHolidaysWholesaleCostCents < 0) throw new Error('Invalid package cost.');
  const platformFeeCents = 0;
  const organizerFeeCents = 0;
  const bidderFeeCents = 0;
  const bidderTotalCents = hammerPriceCents + bidderFeeCents;
  const applicationFeeCents = platformFeeCents + giveHolidaysWholesaleCostCents + giveHolidaysMarkupCents;
  if (applicationFeeCents > bidderTotalCents) throw new Error('The winning price does not cover the travel-package settlement.');
  return {
    hammerPriceCents,
    platformFeeCents,
    organizerFeeCents,
    bidderFeeCents,
    giveHolidaysMarkupCents,
    giveHolidaysWholesaleCostCents,
    bidderTotalCents,
    organizerGrossCents: hammerPriceCents - organizerFeeCents - giveHolidaysWholesaleCostCents - giveHolidaysMarkupCents,
    applicationFeeCents,
  };
}

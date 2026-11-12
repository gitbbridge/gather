export const AUCTION_PLATFORM_FEE_RATE = 0.05;
export const AUCTION_PLATFORM_FEE_CAP_CENTS = 10_000;

export function calculateAuctionPayment(hammerPriceCents: number, organizerSharePercent: number, giveHolidaysMarkupCents = 0, giveHolidaysWholesaleCostCents = 0) {
  if (!Number.isInteger(hammerPriceCents) || hammerPriceCents < 0) throw new Error('Invalid hammer price.');
  if (!Number.isInteger(organizerSharePercent) || organizerSharePercent < 0 || organizerSharePercent > 100) throw new Error('Invalid fee allocation.');
  if (!Number.isInteger(giveHolidaysMarkupCents) || giveHolidaysMarkupCents < 0) throw new Error('Invalid package markup.');
  if (!Number.isInteger(giveHolidaysWholesaleCostCents) || giveHolidaysWholesaleCostCents < 0) throw new Error('Invalid package cost.');
  const platformFeeCents = Math.min(
    Math.round(hammerPriceCents * AUCTION_PLATFORM_FEE_RATE),
    AUCTION_PLATFORM_FEE_CAP_CENTS,
  );
  const organizerFeeCents = Math.round(platformFeeCents * organizerSharePercent / 100);
  const bidderFeeCents = platformFeeCents - organizerFeeCents;
  const bidderTotalCents = hammerPriceCents + bidderFeeCents;
  const applicationFeeCents = platformFeeCents + giveHolidaysWholesaleCostCents + giveHolidaysMarkupCents;
  if (applicationFeeCents > bidderTotalCents) throw new Error('The winning price does not cover the platform fee and travel-package settlement.');
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

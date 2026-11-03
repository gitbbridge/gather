export function calculateAuctionPayment(hammerPriceCents: number, organizerSharePercent: number, giveHolidaysMarkupCents = 0) {
  if (!Number.isInteger(hammerPriceCents) || hammerPriceCents < 0) throw new Error('Invalid hammer price.');
  if (!Number.isInteger(organizerSharePercent) || organizerSharePercent < 0 || organizerSharePercent > 100) throw new Error('Invalid fee allocation.');
  if (!Number.isInteger(giveHolidaysMarkupCents) || giveHolidaysMarkupCents < 0) throw new Error('Invalid package markup.');
  const platformFeeCents = Math.round(hammerPriceCents * 0.05);
  const organizerFeeCents = Math.round(platformFeeCents * organizerSharePercent / 100);
  const bidderFeeCents = platformFeeCents - organizerFeeCents;
  return {
    hammerPriceCents,
    platformFeeCents,
    organizerFeeCents,
    bidderFeeCents,
    giveHolidaysMarkupCents,
    bidderTotalCents: hammerPriceCents + bidderFeeCents + giveHolidaysMarkupCents,
    organizerGrossCents: hammerPriceCents - organizerFeeCents,
    applicationFeeCents: platformFeeCents + giveHolidaysMarkupCents,
  };
}

export type DirectOfferStatus =
  "draft" | "active" | "expired" | "sold_out" | "paused" | "archived";
export function directOfferPricing(
  packageCostCents: number,
  fundraisingAmountCents: number,
  platformFeeCents = 0,
  taxCents = 0,
) {
  const unitPriceCents =
    packageCostCents + fundraisingAmountCents + platformFeeCents + taxCents;
  return {
    packageCostCents,
    fundraisingAmountCents,
    platformFeeCents,
    taxCents,
    unitPriceCents,
    expectedNonprofitProceedsCents: fundraisingAmountCents,
  };
}
export function directOfferSlug(title: string) {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
export function availableOfferQuantity(offer: {
  availableQuantity: number;
  quantityReserved: number;
  quantitySold: number;
}) {
  return Math.max(
    0,
    offer.availableQuantity - offer.quantityReserved - offer.quantitySold,
  );
}

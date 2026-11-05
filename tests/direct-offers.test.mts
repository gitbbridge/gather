import test from "node:test";
import assert from "node:assert/strict";
import {
  availableOfferQuantity,
  directOfferPricing,
  directOfferSlug,
} from "../lib/direct-offers.ts";
test("direct offer pricing does not inherit the auction commission", () => {
  assert.deepEqual(directOfferPricing(120000, 80000), {
    packageCostCents: 120000,
    fundraisingAmountCents: 80000,
    platformFeeCents: 0,
    taxCents: 0,
    unitPriceCents: 200000,
    expectedNonprofitProceedsCents: 80000,
  });
});
test("available quantity excludes paid and reserved purchases", () => {
  assert.equal(
    availableOfferQuantity({
      availableQuantity: 5,
      quantityReserved: 2,
      quantitySold: 2,
    }),
    1,
  );
  assert.equal(
    availableOfferQuantity({
      availableQuantity: 1,
      quantityReserved: 2,
      quantitySold: 2,
    }),
    0,
  );
});
test("offer slugs remain shareable and URL safe", () => {
  assert.equal(
    directOfferSlug("Costa Rica: Travel That Gives Back!"),
    "costa-rica-travel-that-gives-back",
  );
});

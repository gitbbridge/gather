import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultTicketDesign,
  effectiveTicketStatus,
  remainingTicketInventory,
  ticketOrderTotals,
  validTicketDesign,
} from "../lib/tickets.ts";

const base = {
  status: "on_sale" as const,
  salesStartAt: "2026-11-01T00:00:00Z",
  salesEndAt: "2026-12-01T00:00:00Z",
  capacity: 100,
  reserved: 8,
  sold: 80,
};

test("ticket inventory excludes paid and reserved admissions", () => {
  assert.equal(remainingTicketInventory(base), 12);
});

test("ticket schedules and sold-out inventory determine public status", () => {
  assert.equal(effectiveTicketStatus(base, new Date("2026-11-05")), "on_sale");
  assert.equal(
    effectiveTicketStatus(
      { ...base, salesStartAt: "2026-11-10T00:00:00Z" },
      new Date("2026-11-05"),
    ),
    "scheduled",
  );
  assert.equal(
    effectiveTicketStatus({ ...base, reserved: 20 }, new Date("2026-11-05")),
    "sold_out",
  );
});

test("ticket totals do not inherit the auction commission", () => {
  assert.deepEqual(ticketOrderTotals([{ unitPriceCents: 7500, quantity: 2 }]), {
    subtotalCents: 15000,
    platformFeeCents: 0,
    processingFeeCents: 0,
    taxCents: 0,
    totalCents: 15000,
  });
});

test("ticket designs are structured and reject arbitrary markup", () => {
  assert.equal(validTicketDesign(defaultTicketDesign), true);
  assert.equal(validTicketDesign({ html: "<script>alert(1)</script>" }), false);
});

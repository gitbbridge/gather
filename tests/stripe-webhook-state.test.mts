import assert from "node:assert/strict";
import test from "node:test";
import {
  WEBHOOK_PROCESSING_LEASE_SECONDS,
  webhookDeliveryIsClaimable,
  webhookFailureMessage,
} from "../lib/stripe-webhook-state.ts";

test("new and failed Stripe events can be claimed", () => {
  assert.equal(webhookDeliveryIsClaimable("accepted", 100, 100), true);
  assert.equal(webhookDeliveryIsClaimable("failed", 100, 100), true);
});

test("processed and actively processing events remain idempotent", () => {
  const now = 10_000;
  assert.equal(webhookDeliveryIsClaimable("processed", 1, now), false);
  assert.equal(webhookDeliveryIsClaimable("processing", now - 10, now), false);
});

test("an abandoned processing lease can be retried", () => {
  const now = 10_000;
  assert.equal(
    webhookDeliveryIsClaimable(
      "processing",
      now - WEBHOOK_PROCESSING_LEASE_SECONDS,
      now,
    ),
    true,
  );
});

test("webhook errors are bounded before persistence", () => {
  assert.equal(webhookFailureMessage("failure"), "Unknown processing error");
  assert.equal(webhookFailureMessage(new Error("x".repeat(1200))).length, 1000);
});

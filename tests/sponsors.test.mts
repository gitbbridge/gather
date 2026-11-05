import test from "node:test";
import assert from "node:assert/strict";
import {
  boundedAllocation,
  coverageFlags,
  safeSponsorWebsite,
  sponsorRecognitionCopy,
  sponsorshipBalance,
} from "../lib/sponsors.ts";

test("coverage categories remain explicit", () => {
  assert.deepEqual(coverageFlags("platform"), {
    coversPlatform: true,
    coversProcessing: false,
  });
  assert.deepEqual(coverageFlags("both"), {
    coversPlatform: true,
    coversProcessing: true,
  });
});

test("fee allocations stop exactly at the authorized maximum", () => {
  assert.equal(boundedAllocation(800, 700), 700);
  assert.equal(boundedAllocation(500, 700), 500);
});

test("sponsorship balances do not treat commitments as collected cash", () => {
  assert.deepEqual(
    sponsorshipBalance({
      maximumCents: 250_000,
      allocatedCents: 180_000,
      chargedCents: 120_000,
      refundedCents: 5_000,
    }),
    {
      maximumCents: 250_000,
      allocatedCents: 180_000,
      chargedCents: 120_000,
      refundedCents: 5_000,
      remainingCents: 70_000,
      outstandingCents: 65_000,
    },
  );
});

test("recognition copy qualifies capped coverage", () => {
  const copy = sponsorRecognitionCopy({
    sponsorName: "ABC Company",
    coverage: "both",
    maximumCents: 250_000,
    remainingCents: 70_000,
  });
  assert.match(copy, /up to its sponsorship commitment/i);
  assert.equal(
    sponsorRecognitionCopy({
      sponsorName: "ABC Company",
      coverage: "both",
      maximumCents: 250_000,
      remainingCents: 0,
    }),
    "",
  );
});

test("public sponsor websites require HTTPS", () => {
  assert.equal(safeSponsorWebsite("http://example.com"), null);
  assert.equal(safeSponsorWebsite("javascript:alert(1)"), null);
  assert.equal(safeSponsorWebsite("https://example.com"), "https://example.com/");
});

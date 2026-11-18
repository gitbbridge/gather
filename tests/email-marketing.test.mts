import assert from "node:assert/strict";
import test from "node:test";
import { aggregateCampaignMetrics, contactCanReceiveMarketing, eligibleAudience, renderCampaignHtml, type AudienceRule, type MarketingContact, type MarketingPreference } from "../lib/email-marketing.ts";

const contact = (id: string, tags: string[] = []): MarketingContact => ({ id, tags, last_activity_at: "2026-11-01T12:00:00Z", supporter_activities: [] });
const preference = (supporterId: string, marketing_status: MarketingPreference["marketing_status"] = "subscribed", validation_status: MarketingPreference["validation_status"] = "deliverable"): MarketingPreference => ({ supporter_id: supporterId, marketing_status, validation_status, suppressed_at: null });

test("marketing eligibility excludes missing consent, unsubscribes, complaints, and undeliverable contacts", () => {
  assert.equal(contactCanReceiveMarketing(undefined), false);
  assert.equal(contactCanReceiveMarketing(preference("one")), true);
  assert.equal(contactCanReceiveMarketing(preference("one", "unsubscribed")), false);
  assert.equal(contactCanReceiveMarketing(preference("one", "complained")), false);
  assert.equal(contactCanReceiveMarketing(preference("one", "subscribed", "undeliverable")), false);
});

test("audience rules support AND and OR without bypassing consent", () => {
  const contacts = [contact("one", ["gala", "travel"]), contact("two", ["gala"]), contact("three", ["travel"])];
  const preferences = [preference("one"), preference("two"), preference("three", "unsubscribed")];
  const rules: AudienceRule[] = [
    { id: "a", field: "tag", operator: "is", value: "gala" },
    { id: "b", field: "tag", operator: "is", value: "travel" },
  ];
  assert.deepEqual(eligibleAudience(contacts, preferences, rules, "and").map((item) => item.id), ["one"]);
  assert.deepEqual(eligibleAudience(contacts, preferences, rules, "or").map((item) => item.id), ["one", "two"]);
});

test("email renderer escapes content, rejects unsafe destinations, and includes unsubscribe", () => {
  const html = renderCampaignHtml([
    { id: "heading", type: "heading", content: "<script>alert('x')</script>" },
    { id: "button", type: "button", content: "Open", href: "javascript:alert(1)" },
  ], "https://gatherforgood.bid/api/email-marketing/unsubscribe?token=signed");
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /href="#"/);
  assert.match(html, /Unsubscribe/);
  assert.match(html, /token=signed/);
});

test("campaign metrics use recorded counts only", () => {
  const result = aggregateCampaignMetrics([
    { delivered_count: 100, open_count: 40, click_count: 10, unsubscribe_count: 2, attributed_amount_cents: 12500 },
    { delivered_count: 50, open_count: 20, click_count: 5, unsubscribe_count: 1, attributed_amount_cents: 7500 },
  ]);
  assert.equal(result.delivered, 150);
  assert.equal(result.openRate, 0.4);
  assert.equal(result.clickRate, 0.1);
  assert.equal(result.unsubscribeRate, 0.02);
  assert.equal(result.attributedAmountCents, 20000);
});

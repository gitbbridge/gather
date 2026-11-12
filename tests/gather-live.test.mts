import test from "node:test";
import assert from "node:assert/strict";
import { canTransitionLiveSession, liveRoleCan, nextLiveBid, pledgeTotals } from "../lib/gather-live.ts";
import { readFileSync } from "node:fs";

test("session transitions are explicit and ended sessions cannot reopen", () => {
  assert.equal(canTransitionLiveSession("not_started", "ready"), true);
  assert.equal(canTransitionLiveSession("ready", "active"), true);
  assert.equal(canTransitionLiveSession("active", "paused"), true);
  assert.equal(canTransitionLiveSession("paused", "active"), true);
  assert.equal(canTransitionLiveSession("ended", "active"), false);
  assert.equal(canTransitionLiveSession("not_started", "active"), false);
});

test("live bid increments are deterministic", () => {
  assert.equal(nextLiveBid(0, 10_000, 2_500), 10_000);
  assert.equal(nextLiveBid(25_000, 10_000, 2_500), 27_500);
});

test("roles have least-privilege event controls", () => {
  assert.equal(liveRoleCan("auction_clerk", "record_bid"), true);
  assert.equal(liveRoleCan("auction_clerk", "record_pledge"), false);
  assert.equal(liveRoleCan("screen_operator", "projector"), true);
  assert.equal(liveRoleCan("event_director", "transition_session"), true);
});

test("pledged and collected remain separate totals", () => {
  assert.deepEqual(pledgeTotals([{ amount_cents: 10000, status: "pledged" }, { amount_cents: 25000, status: "paid" }, { amount_cents: 5000, status: "cancelled" }]), { pledged: 35000, collected: 25000 });
});

test("migration keeps donations fee-free and bid recording idempotent", () => {
  const source = readFileSync(new URL("../supabase/migrations/202611050008_gather_live.sql", import.meta.url), "utf8");
  assert.match(source, /'fund_pledge'[\s\S]*p_amount_cents,0\)/);
  assert.match(source, /unique \(auction_id,request_id\)/);
  assert.match(source, /for update/);
  assert.match(source, /revoke all on function public\.record_live_bid/);
});

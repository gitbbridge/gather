import { liveEventAccess } from "@/lib/live-access";
import { canTransitionLiveSession, liveRoleCan, type LiveSessionStatus } from "@/lib/gather-live";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { database } from "@/lib/nonprofits";
import { paymentConnection } from "@/lib/payments";

export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "cache-control": "no-store" } });
const id = () => crypto.randomUUID();

async function initialize(access: NonNullable<Awaited<ReturnType<typeof liveEventAccess>>>) {
  const client = createSupabaseAdminClient();
  const organizationId = access.nonprofit!.id;
  const auctionId = access.row.id;
  await client.from("live_event_sessions").upsert({ auction_id: auctionId, organization_id: organizationId }, { onConflict: "auction_id", ignoreDuplicates: true });
  await client.from("fund_a_need_appeals").upsert({ auction_id: auctionId, organization_id: organizationId }, { onConflict: "auction_id", ignoreDuplicates: true });
  const { data: existing } = await client.from("live_lots").select("auction_item_id").eq("auction_id", auctionId);
  const existingIds = new Set((existing || []).map((row) => row.auction_item_id));
  const { data: catalogItems } = await client.from("auction_items").select("id").eq("auction_id", auctionId);
  const catalogIds = new Set((catalogItems || []).map((row) => row.id));
  const lots = access.auction.items.filter((item) => catalogIds.has(item.id) && !existingIds.has(item.id)).map((item, index) => ({
    auction_id: auctionId, organization_id: organizationId, auction_item_id: item.id,
    lot_number: existingIds.size + index + 1, run_order: existingIds.size + index + 1,
    opening_bid_cents: item.start, current_bid_cents: 0, increment_cents: item.increment,
  }));
  if (lots.length) await client.from("live_lots").insert(lots);
}

async function payload(access: NonNullable<Awaited<ReturnType<typeof liveEventAccess>>>) {
  await initialize(access);
  const client = createSupabaseAdminClient();
  const auctionId = access.row.id;
  const [session, paddles, lots, appeal, pledges, actions, staff, payment] = await Promise.all([
    client.from("live_event_sessions").select("*").eq("auction_id", auctionId).single(),
    client.from("event_paddles").select("*").eq("auction_id", auctionId).order("paddle_number"),
    client.from("live_lots").select("*,auction_items(title,image_url,fair_market_value_cents)").eq("auction_id", auctionId).order("run_order"),
    client.from("fund_a_need_appeals").select("*").eq("auction_id", auctionId).single(),
    client.from("fund_a_need_pledges").select("*,event_paddles(paddle_number,display_name)").eq("auction_id", auctionId).order("created_at", { ascending: false }),
    client.from("live_event_actions").select("*").eq("auction_id", auctionId).order("created_at", { ascending: false }).limit(30),
    client.from("live_event_staff").select("*").eq("auction_id", auctionId).eq("active", true),
    paymentConnection(access.nonprofit!.id),
  ]);
  for (const result of [session, paddles, lots, appeal, pledges, actions, staff]) if (result.error) throw result.error;
  return { auction: { id: auctionId, name: access.auction.name, eventType: access.auction.eventType, timezone: access.auction.timezone }, organization: access.nonprofit, role: access.role, session: session.data, paddles: paddles.data || [], lots: lots.data || [], appeal: appeal.data, pledges: pledges.data || [], actions: actions.data || [], staff: staff.data || [], payment };
}

export async function GET(request: Request) {
  try {
    const auctionId = new URL(request.url).searchParams.get("auction") || "";
    const access = await liveEventAccess(auctionId);
    if (!access) return json({ error: "Access denied." }, 403);
    return json(await payload(access));
  } catch (error) { console.error(error); return json({ error: error instanceof Error ? error.message : "Unable to load Gather Live." }, 500); }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Invalid origin." }, 403);
    const body = await request.json() as Record<string, unknown>;
    const auctionId = String(body.auctionId || "");
    const access = await liveEventAccess(auctionId);
    if (!access) return json({ error: "Access denied." }, 403);
    const action = String(body.action || "");
    if (!liveRoleCan(access.role, action)) return json({ error: "Your live-event role cannot perform that action." }, 403);
    await initialize(access);
    const client = createSupabaseAdminClient();
    const organizationId = access.nonprofit!.id;
    const audit = async (reason?: string, details: Record<string, unknown> = {}) => {
      const { error } = await client.from("live_event_actions").insert({ auction_id: auctionId, action, actor_id: access.user.userId, reason: reason || null, details });
      if (error) throw error;
    };

    if (action === "transition_session") {
      const { data: current, error } = await client.from("live_event_sessions").select("status").eq("auction_id", auctionId).single();
      if (error) throw error;
      const next = String(body.status) as LiveSessionStatus;
      if (!canTransitionLiveSession(current.status as LiveSessionStatus, next)) return json({ error: `Cannot move a ${current.status} session to ${next}.` }, 409);
      if (next === "active" && current.status === "ready") {
        const [{ count: paddles }, { count: lots }] = await Promise.all([
          client.from("event_paddles").select("id", { count: "exact", head: true }).eq("auction_id", auctionId).eq("status", "active"),
          client.from("live_lots").select("id", { count: "exact", head: true }).eq("auction_id", auctionId).in("status", ["scheduled", "ready"]),
        ]);
        const connection = await paymentConnection(organizationId);
        if (!paddles || !lots || connection.status !== "ready") return json({ error: "Before going live, add an active paddle and live lot, and finish Stripe setup." }, 409);
      }
      const timestamps: Record<string, unknown> = next === "active" ? { started_at: new Date().toISOString(), started_by: access.user.userId } : next === "paused" ? { paused_at: new Date().toISOString() } : next === "ended" ? { ended_at: new Date().toISOString(), ended_by: access.user.userId } : {};
      const { error: updateError } = await client.from("live_event_sessions").update({ status: next, last_reason: String(body.reason || "") || null, version: Number(body.version || 1) + 1, ...timestamps }).eq("auction_id", auctionId).eq("status", current.status);
      if (updateError) throw updateError;
      access.auction.liveSessionStatus = next;
      await database().prepare("UPDATE auctions SET state=?,updated_at=? WHERE id=?").bind(JSON.stringify(access.auction), Date.now(), auctionId).run();
      await client.from("auctions").update({ live_session_status: next }).eq("id", auctionId);
      await audit(String(body.reason || ""), { from: current.status, to: next });
    } else if (action === "assign_paddle") {
      const paddleNumber = Number(body.paddleNumber); const displayName = String(body.displayName || "").trim();
      if (!Number.isInteger(paddleNumber) || paddleNumber < 1 || !displayName) return json({ error: "Enter a valid paddle number and participant name." }, 400);
      const { data: paddle, error } = await client.from("event_paddles").insert({ auction_id: auctionId, organization_id: organizationId, paddle_number: paddleNumber, display_name: displayName, email: String(body.email || "") || null, user_id: body.userId || null, supporter_id: body.supporterId || null, ticket_id: body.ticketId || null, assigned_by: access.user.userId }).select().single();
      if (error) throw error;
      await client.from("paddle_assignment_events").insert({ auction_id: auctionId, paddle_id: paddle.id, event_type: "assigned", actor_id: access.user.userId, snapshot: paddle });
      await audit(undefined, { paddleNumber });
    } else if (action === "revoke_paddle") {
      const paddleId = String(body.paddleId || ""); const reason = String(body.reason || "").trim();
      if (!reason) return json({ error: "A reason is required to revoke a paddle." }, 400);
      const { data: paddle, error } = await client.from("event_paddles").update({ status: "revoked" }).eq("id", paddleId).eq("auction_id", auctionId).eq("status", "active").select().single();
      if (error) throw error;
      await client.from("paddle_assignment_events").insert({ auction_id: auctionId, paddle_id: paddleId, event_type: "revoked", actor_id: access.user.userId, reason, snapshot: paddle });
      await audit(reason, { paddleId });
    } else if (action === "open_lot") {
      const lotId = String(body.lotId || "");
      const { data: session } = await client.from("live_event_sessions").select("status").eq("auction_id", auctionId).single();
      if (session?.status !== "active") return json({ error: "Start the live session before opening a lot." }, 409);
      await client.from("live_lots").update({ status: "ready" }).eq("auction_id", auctionId).eq("status", "bidding_open");
      const { error } = await client.from("live_lots").update({ status: "bidding_open" }).eq("id", lotId).eq("auction_id", auctionId).in("status", ["scheduled", "ready"]);
      if (error) throw error; await audit(undefined, { lotId });
    } else if (action === "record_bid") {
      const { error } = await client.rpc("record_live_bid", { p_lot_id: body.lotId, p_paddle_id: body.paddleId, p_amount_cents: Number(body.amountCents), p_request_id: body.requestId || id(), p_actor_id: access.user.userId });
      if (error) throw error;
    } else if (action === "finalize_lot") {
      const outcome = String(body.outcome); if (!["sold", "passed"].includes(outcome)) return json({ error: "Choose Sold or Passed." }, 400);
      const { data: lot, error } = await client.rpc("finalize_live_lot", { p_lot_id: body.lotId, p_outcome: outcome, p_request_id: body.requestId || id(), p_actor_id: access.user.userId, p_reason: String(body.reason || "") || null }).single();
      if (error) throw error;
      const finalizedLot = lot as { auction_item_id?: unknown; current_bid_cents?: unknown; winning_paddle_id?: unknown } | null;
      if (!finalizedLot || typeof finalizedLot.auction_item_id !== "string") throw new Error("The finalized live lot response was invalid.");
      const item = access.auction.items.find((entry) => entry.id === finalizedLot.auction_item_id);
      if (item) {
        item.ends = Date.now(); item.sold = outcome === "sold"; item.price = Number(finalizedLot.current_bid_cents || item.price);
        if (outcome === "sold") { const { data: paddle } = await client.from("event_paddles").select("user_id").eq("id", String(finalizedLot.winning_paddle_id || "")).single(); item.leader = paddle?.user_id || ""; }
        await database().prepare("UPDATE auctions SET state=?,updated_at=? WHERE id=?").bind(JSON.stringify(access.auction), Date.now(), auctionId).run();
      }
      await audit(String(body.reason || ""), { lotId: body.lotId, outcome });
    } else if (action === "configure_appeal") {
      const levels = Array.isArray(body.levelsCents) ? body.levelsCents.map(Number).filter((value) => value > 0) : [];
      const { error } = await client.from("fund_a_need_appeals").update({ title: String(body.title || "Fund-a-Need").slice(0, 120), goal_cents: Number(body.goalCents) || null, giving_levels_cents: levels, allow_custom: body.allowCustom !== false, active: Boolean(body.active) }).eq("auction_id", auctionId);
      if (error) throw error; await audit();
    } else if (action === "record_pledge") {
      const { error } = await client.rpc("record_fund_a_need_pledge", { p_appeal_id: body.appealId, p_paddle_id: body.paddleId, p_amount_cents: Number(body.amountCents), p_request_id: body.requestId || id(), p_actor_id: access.user.userId });
      if (error) throw error;
    } else if (action === "cancel_pledge") {
      const reason = String(body.reason || "").trim(); if (!reason) return json({ error: "A reason is required to cancel a pledge." }, 400);
      const { error } = await client.from("fund_a_need_pledges").update({ status: "cancelled", reversal_reason: reason, reversed_by: access.user.userId, reversed_at: new Date().toISOString() }).eq("id", body.pledgeId).eq("auction_id", auctionId).in("status", ["pledged", "payment_pending"]);
      if (error) throw error; await client.from("live_event_obligations").update({ status: "cancelled" }).eq("source_type", "fund_pledge").eq("source_id", body.pledgeId); await audit(reason, { pledgeId: body.pledgeId });
    } else if (action === "projector") {
      const mode = String(body.mode); if (!["lot", "fund_a_need", "thanks"].includes(mode)) return json({ error: "Invalid projector mode." }, 400);
      const { error } = await client.from("live_event_sessions").update({ projector_mode: mode, public_message: String(body.message || "").slice(0, 240), version: Number(body.version || 1) + 1 }).eq("auction_id", auctionId);
      if (error) throw error; await audit(undefined, { mode });
    } else return json({ error: "Unknown live-event action." }, 400);
    return json(await payload(access));
  } catch (error) { console.error(error); return json({ error: error instanceof Error ? error.message : "Unable to update Gather Live." }, 500); }
}

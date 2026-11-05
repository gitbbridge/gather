import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const auctionId = new URL(request.url).searchParams.get("auction") || "";
    if (!/^[0-9a-f-]{36}$/i.test(auctionId)) return Response.json({ error: "Event not found." }, { status: 404 });
    const client = createSupabaseAdminClient();
    const [auction, session, lot, appeal, pledges] = await Promise.all([
      client.from("auctions").select("name").eq("id", auctionId).single(),
      client.from("live_event_sessions").select("status,projector_mode,public_message,version,updated_at").eq("auction_id", auctionId).single(),
      client.from("live_lots").select("status,current_bid_cents,lot_number,auction_items(title,image_url)").eq("auction_id", auctionId).eq("status", "bidding_open").limit(1).maybeSingle(),
      client.from("fund_a_need_appeals").select("title,goal_cents").eq("auction_id", auctionId).single(),
      client.from("fund_a_need_pledges").select("amount_cents,status").eq("auction_id", auctionId).not("status", "in", "(cancelled,refunded)"),
    ]);
    if (auction.error || session.error) return Response.json({ error: "Live event not found." }, { status: 404 });
    const pledged = (pledges.data || []).reduce((sum, row) => sum + Number(row.amount_cents), 0);
    return Response.json({ auction: auction.data, session: session.data, lot: lot.data, appeal: appeal.data, pledged, generatedAt: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
  } catch (error) { console.error(error); return Response.json({ error: "The live display is temporarily unavailable." }, { status: 503, headers: { "cache-control": "no-store" } }); }
}

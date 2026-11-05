import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { effectiveTicketStatus, remainingTicketInventory } from "@/lib/tickets";

export async function GET(request: Request) {
  const auctionId = new URL(request.url).searchParams.get("auction") || "";
  if (!z.string().uuid().safeParse(auctionId).success)
    return Response.json({ error: "Event not found." }, { status: 404 });
  const client = createSupabaseAdminClient();
  const { data: auction } = await client
    .from("auctions")
    .select(
      "id,organization_id,name,description,status,event_starts_at,venue_name,venue_address,event_timezone,ticketing_enabled,organizations(display_name,slug,accent_color)",
    )
    .eq("id", auctionId)
    .maybeSingle();
  if (!auction?.ticketing_enabled)
    return Response.json(
      { error: "Tickets are not available for this event." },
      { status: 404 },
    );
  const { data: rows, error } = await client
    .from("ticket_types")
    .select(
      "id,name,description,category,benefits,price_cents,capacity,inventory_reserved,inventory_sold,maximum_per_order,admissions_per_unit,sales_start_at,sales_end_at,status,show_remaining_inventory,terms_version",
    )
    .eq("auction_id", auctionId)
    .eq("visibility", "public")
    .in("status", ["scheduled", "on_sale", "sold_out", "closed"])
    .order("price_cents");
  if (error)
    return Response.json(
      { error: "Ticket sales are temporarily unavailable." },
      { status: 503 },
    );
  const tickets = (rows || []).map((row) => ({
    ...row,
    effectiveStatus: effectiveTicketStatus({
      status: row.status,
      salesStartAt: row.sales_start_at,
      salesEndAt: row.sales_end_at,
      capacity: row.capacity,
      reserved: row.inventory_reserved,
      sold: row.inventory_sold,
    }),
    remaining: row.show_remaining_inventory
      ? remainingTicketInventory({
          status: row.status,
          salesStartAt: row.sales_start_at,
          salesEndAt: row.sales_end_at,
          capacity: row.capacity,
          reserved: row.inventory_reserved,
          sold: row.inventory_sold,
        })
      : null,
  }));
  return Response.json({ auction, tickets });
}

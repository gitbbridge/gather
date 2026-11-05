import { z } from "zod";
import { getAppUser } from "@/lib/auth";
import { managedOrganization } from "@/lib/organizer-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { defaultTicketDesign, validTicketDesign } from "@/lib/tickets";

const ticketSchema = z.object({
  action: z.enum(["save_ticket", "save_design", "settings", "duplicate"]),
  organizationId: z.string().uuid(),
  auctionId: z.string().uuid(),
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(3000).optional(),
  category: z.string().trim().min(2).max(80).optional(),
  benefits: z.string().trim().max(2000).optional(),
  priceCents: z.number().int().min(0).max(10_000_000).optional(),
  capacity: z.number().int().min(1).max(100_000).optional(),
  admissionsPerUnit: z.number().int().min(1).max(100).optional(),
  maximumPerOrder: z.number().int().min(1).max(100).optional(),
  salesStartAt: z.string().datetime().nullable().optional(),
  salesEndAt: z.string().datetime().nullable().optional(),
  status: z
    .enum(["draft", "scheduled", "on_sale", "closed", "cancelled"])
    .optional(),
  visibility: z.enum(["public", "unlisted", "hidden"]).optional(),
  guestInformationRequired: z.boolean().optional(),
  showRemainingInventory: z.boolean().optional(),
  designId: z.string().uuid().nullable().optional(),
  design: z.unknown().optional(),
  ticketingEnabled: z.boolean().optional(),
  eventTimezone: z.string().trim().min(1).max(80).optional(),
});

async function access(organizationId: string, auctionId: string) {
  const user = await getAppUser();
  if (!user) return null;
  const managed = await managedOrganization(organizationId);
  if (!managed) return null;
  const client = createSupabaseAdminClient();
  const { data: auction } = await client
    .from("auctions")
    .select(
      "id,organization_id,name,event_type,event_starts_at,venue_name,venue_address,ticketing_enabled,event_timezone",
    )
    .eq("id", auctionId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return auction ? { client, user, auction } : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organization") || "";
  const auctionId = url.searchParams.get("auction") || "";
  if (
    !z.string().uuid().safeParse(organizationId).success ||
    !z.string().uuid().safeParse(auctionId).success
  )
    return Response.json(
      { error: "Choose an event from its organizer dashboard." },
      { status: 400 },
    );
  const permitted = await access(organizationId, auctionId);
  if (!permitted)
    return Response.json({ error: "Event access denied." }, { status: 403 });
  const [types, designs, orders] = await Promise.all([
    permitted.client
      .from("ticket_types")
      .select("*,ticket_designs(name,config)")
      .eq("auction_id", auctionId)
      .order("created_at"),
    permitted.client
      .from("ticket_designs")
      .select("*")
      .eq("auction_id", auctionId)
      .order("updated_at", { ascending: false }),
    permitted.client
      .from("ticket_orders")
      .select(
        "id,purchaser_name,purchaser_email,subtotal_cents,processing_fee_cents,total_cents,status,paid_at,created_at,ticket_order_items(quantity,admissions_per_unit,ticket_type_snapshot),event_tickets(id,status,checked_in_at)",
      )
      .eq("auction_id", auctionId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  const error = types.error || designs.error || orders.error;
  if (error)
    return Response.json(
      {
        error:
          "Ticketing tables are not available yet. Apply migration 006 first.",
      },
      { status: 503 },
    );
  return Response.json({
    auction: permitted.auction,
    ticketTypes: types.data || [],
    designs: designs.data || [],
    orders: orders.data || [],
    defaultDesign: defaultTicketDesign,
  });
}

export async function POST(request: Request) {
  const parsed = ticketSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: "Review the ticket details and try again." },
      { status: 400 },
    );
  const input = parsed.data;
  const permitted = await access(input.organizationId, input.auctionId);
  if (!permitted)
    return Response.json({ error: "Event access denied." }, { status: 403 });

  if (input.action === "settings") {
    const { error } = await permitted.client
      .from("auctions")
      .update({
        ticketing_enabled: input.ticketingEnabled,
        event_timezone: input.eventTimezone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.auctionId)
      .eq("organization_id", input.organizationId);
    return error
      ? Response.json(
          { error: "Unable to update ticket settings." },
          { status: 500 },
        )
      : Response.json({ ok: true });
  }

  if (input.action === "save_design") {
    if (!input.name || !validTicketDesign(input.design))
      return Response.json(
        { error: "The ticket design is incomplete or unsafe." },
        { status: 400 },
      );
    const record = {
      organization_id: input.organizationId,
      auction_id: input.auctionId,
      name: input.name,
      config: input.design,
      created_by: permitted.user.userId,
      updated_at: new Date().toISOString(),
    };
    const result = input.id
      ? await permitted.client
          .from("ticket_designs")
          .update(record)
          .eq("id", input.id)
          .eq("auction_id", input.auctionId)
          .select("*")
          .single()
      : await permitted.client
          .from("ticket_designs")
          .insert(record)
          .select("*")
          .single();
    return result.error
      ? Response.json(
          { error: "Unable to save ticket design." },
          { status: 500 },
        )
      : Response.json({ design: result.data });
  }

  if (input.action === "duplicate" && input.id) {
    const { data: source } = await permitted.client
      .from("ticket_types")
      .select("*")
      .eq("id", input.id)
      .eq("auction_id", input.auctionId)
      .single();
    if (!source)
      return Response.json(
        { error: "Ticket type not found." },
        { status: 404 },
      );
    const {
      id: _id,
      inventory_reserved: _reserved,
      inventory_sold: _sold,
      created_at: _created,
      updated_at: _updated,
      ...copy
    } = source;
    const result = await permitted.client
      .from("ticket_types")
      .insert({
        ...copy,
        name: `${source.name} copy`,
        status: "draft",
        inventory_reserved: 0,
        inventory_sold: 0,
        created_by: permitted.user.userId,
      })
      .select("*")
      .single();
    return result.error
      ? Response.json(
          { error: "Unable to duplicate ticket type." },
          { status: 500 },
        )
      : Response.json({ ticketType: result.data });
  }

  if (
    !input.name ||
    input.priceCents === undefined ||
    !input.capacity ||
    !input.category ||
    !input.admissionsPerUnit ||
    !input.maximumPerOrder
  )
    return Response.json(
      { error: "Complete the ticket name, price, capacity, and order limits." },
      { status: 400 },
    );
  if (
    input.salesStartAt &&
    input.salesEndAt &&
    new Date(input.salesEndAt) <= new Date(input.salesStartAt)
  )
    return Response.json(
      { error: "Ticket sales must end after they begin." },
      { status: 400 },
    );
  const record = {
    organization_id: input.organizationId,
    auction_id: input.auctionId,
    design_id: input.designId || null,
    name: input.name,
    description: input.description || "",
    category: input.category,
    benefits: input.benefits || "",
    price_cents: input.priceCents,
    capacity: input.capacity,
    admissions_per_unit: input.admissionsPerUnit,
    maximum_per_order: input.maximumPerOrder,
    sales_start_at: input.salesStartAt || null,
    sales_end_at: input.salesEndAt || null,
    status: input.status || "draft",
    visibility: input.visibility || "public",
    guest_information_required: input.guestInformationRequired ?? true,
    show_remaining_inventory: input.showRemainingInventory ?? false,
    created_by: permitted.user.userId,
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { data: existing } = await permitted.client
      .from("ticket_types")
      .select("inventory_reserved,inventory_sold")
      .eq("id", input.id)
      .eq("auction_id", input.auctionId)
      .single();
    if (!existing)
      return Response.json(
        { error: "Ticket type not found." },
        { status: 404 },
      );
    if (
      input.capacity <
      Number(existing.inventory_reserved) + Number(existing.inventory_sold)
    )
      return Response.json(
        { error: "Capacity cannot be lower than sold and reserved tickets." },
        { status: 409 },
      );
  }
  const result = input.id
    ? await permitted.client
        .from("ticket_types")
        .update(record)
        .eq("id", input.id)
        .eq("auction_id", input.auctionId)
        .select("*")
        .single()
    : await permitted.client
        .from("ticket_types")
        .insert(record)
        .select("*")
        .single();
  return result.error
    ? Response.json({ error: "Unable to save ticket type." }, { status: 500 })
    : Response.json({ ticketType: result.data });
}

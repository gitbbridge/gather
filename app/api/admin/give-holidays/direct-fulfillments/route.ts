import { z } from "zod";
import { platformSecurityAccess } from "@/lib/security/privileged-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordSupporterActivity } from "@/lib/supabase/supporters";
const schema = z.object({
  id: z.string().uuid(),
  status: z.enum([
    "awaiting_concierge_assignment",
    "welcome_sent",
    "guest_contacted",
    "planning_in_progress",
    "awaiting_availability",
    "booking_confirmed",
    "travel_completed",
    "closed",
    "cancelled",
    "refunded",
  ]),
  assignedConcierge: z.string().trim().max(120).optional(),
  supplierConfirmationReference: z.string().trim().max(200).optional(),
  internalNotes: z.string().trim().max(3000).optional(),
  nextFollowUpAt: z.string().datetime().nullable().optional(),
});
async function allowed() {
  return (await platformSecurityAccess()).allowed;
}
export async function GET() {
  if (!(await allowed()))
    return Response.json(
      { error: "Platform administrator access required." },
      { status: 403 },
    );
  const { data, error } = await createSupabaseAdminClient()
    .from("direct_offer_fulfillments")
    .select(
      "*,direct_offer_orders(purchaser_name,purchaser_email,paid_at,gross_cents,organization_id,direct_offers(title,package_snapshot,organizations(display_name)))",
    )
    .order("created_at", { ascending: false });
  return error
    ? Response.json(
        { error: "Unable to load direct-offer fulfillment." },
        { status: 500 },
      )
    : Response.json(
        { fulfillments: data || [] },
        { headers: { "cache-control": "no-store" } },
      );
}
export async function PATCH(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({ error: "Invalid origin." }, { status: 403 });
  if (!(await allowed()))
    return Response.json(
      { error: "Platform administrator access required." },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: "Review the fulfillment update." },
      { status: 400 },
    );
  const input = parsed.data;
  if (
    input.status === "booking_confirmed" &&
    !input.supplierConfirmationReference
  )
    return Response.json(
      {
        error:
          "A verified supplier confirmation is required before marking a booking confirmed.",
      },
      { status: 400 },
    );
  const client = createSupabaseAdminClient(),
    now = new Date().toISOString();
  const { data, error } = await client
    .from("direct_offer_fulfillments")
    .update({
      status: input.status,
      assigned_concierge: input.assignedConcierge || null,
      supplier_confirmation_reference:
        input.supplierConfirmationReference || null,
      internal_notes: input.internalNotes || null,
      next_follow_up_at: input.nextFollowUpAt || null,
      last_contact_at: ["guest_contacted", "planning_in_progress"].includes(
        input.status,
      )
        ? now
        : undefined,
      updated_at: now,
    })
    .eq("id", input.id)
    .select("*,direct_offer_orders(*)")
    .single();
  if (error)
    return Response.json(
      { error: "Unable to save fulfillment." },
      { status: 500 },
    );
  const order = Array.isArray(data.direct_offer_orders)
    ? data.direct_offer_orders[0]
    : data.direct_offer_orders;
  if (order)
    await recordSupporterActivity({
      organizationId: order.organization_id,
      userId: order.purchaser_user_id,
      email: order.purchaser_email,
      fullName: order.purchaser_name,
      source: "payment",
      type: "direct_offer_fulfillment_status_changed",
      dedupeKey: `direct-fulfillment-${input.id}-${input.status}-${now}`,
      directOfferOrderId: order.id,
      amountCents: order.fundraising_proceeds_cents,
      metadata: {
        status: input.status,
        assignedConcierge: input.assignedConcierge || null,
      },
    });
  return Response.json({ ok: true });
}

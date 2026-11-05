import { z } from "zod";
import { getAppUser } from "@/lib/auth";
import { paymentAccount } from "@/lib/payments";
import { stripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  auctionId: z.string().uuid(),
  organizationSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(2).max(120),
  email: z.string().email().max(320),
  phone: z.string().trim().max(40).optional().default(""),
  lines: z
    .array(
      z.object({
        ticketTypeId: z.string().uuid(),
        quantity: z.number().int().min(1).max(100),
      }),
    )
    .min(1)
    .max(20),
});

export async function POST(request: Request) {
  let orderId: string | null = null;
  const client = createSupabaseAdminClient();
  try {
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !== new URL(request.url).origin
    )
      return Response.json({ error: "Invalid origin." }, { status: 403 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: "Complete your contact information and ticket selection." },
        { status: 400 },
      );
    const input = parsed.data;
    const recent = await client
      .from("ticket_orders")
      .select("id", { count: "exact", head: true })
      .eq("purchaser_email", input.email.toLowerCase())
      .gte("created_at", new Date(Date.now() - 60_000).toISOString());
    if ((recent.count || 0) >= 5)
      return Response.json(
        { error: "Please wait before starting another checkout." },
        { status: 429 },
      );
    const user = await getAppUser();
    const reserved = await client.rpc("reserve_ticket_order", {
      target_auction_id: input.auctionId,
      buyer_name: input.name,
      buyer_email: input.email,
      buyer_phone: input.phone,
      buyer_user_id: user?.provider === "supabase" ? user.userId : null,
      requested_lines: input.lines,
    });
    orderId = reserved.data;
    if (reserved.error || !orderId)
      return Response.json(
        {
          error: reserved.error?.message?.includes("sold out")
            ? "One of these ticket types just sold out."
            : "These tickets are not available in the requested quantity.",
        },
        { status: 409 },
      );
    const { data: order, error } = await client
      .from("ticket_orders")
      .select(
        "*,ticket_order_items(quantity,unit_price_cents,ticket_type_snapshot),auctions(name),organizations(slug)",
      )
      .eq("id", orderId)
      .single();
    if (error || !order) throw error || Error("Order not found");
    const origin = new URL(request.url).origin;
    const returnUrl = `${origin}/n/${input.organizationSlug}/auction/${input.auctionId}/tickets`;

    if (Number(order.total_cents) === 0) {
      const reference = `complimentary-${order.id}`;
      await client
        .from("ticket_orders")
        .update({
          status: "checkout_open",
          stripe_checkout_session_id: reference,
        })
        .eq("id", order.id);
      const completed = await client.rpc("complete_ticket_order", {
        target_order_id: order.id,
        checkout_session_id: reference,
        payment_intent_id: "",
        charge_id: "",
        processor_fee: 0,
      });
      if (completed.error) throw completed.error;
      return Response.json({
        url: `${returnUrl}?purchase=success&order=${order.id}`,
      });
    }

    const connected = await paymentAccount(order.organization_id);
    if (!connected || connected.status !== "ready")
      throw Error("The nonprofit payment account is not ready.");
    const session = await stripe().checkout.sessions.create(
      {
        mode: "payment",
        customer_email: input.email,
        line_items: (order.ticket_order_items || []).map(
          (item: {
            quantity: number;
            unit_price_cents: number;
            ticket_type_snapshot: { name?: string };
          }) => ({
            quantity: item.quantity,
            price_data: {
              currency: "usd",
              unit_amount: item.unit_price_cents,
              product_data: {
                name: item.ticket_type_snapshot?.name || "Event admission",
                description: `${order.auctions?.name || "Gather event"} admission`,
              },
            },
          }),
        ),
        payment_intent_data: {
          metadata: {
            gather_ticket_order_id: order.id,
            gather_auction_id: order.auction_id,
          },
        },
        metadata: {
          gather_ticket_order_id: order.id,
          gather_transaction_type: "ticket_sale",
        },
        success_url: `${returnUrl}?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${returnUrl}?purchase=cancelled`,
        custom_text: {
          submit: {
            message:
              "Admission tickets and auction bidding are separate. Applicable payment processing is disclosed by Stripe before payment.",
          },
        },
      },
      {
        stripeAccount: connected.stripeAccountId,
        idempotencyKey: `ticket-order-${order.id}`,
      },
    );
    if (!session.url) throw Error("Stripe did not return a checkout link.");
    await client
      .from("ticket_orders")
      .update({
        status: "checkout_open",
        stripe_checkout_session_id: session.id,
        connected_account_id: connected.stripeAccountId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    return Response.json({ url: session.url });
  } catch (error) {
    if (orderId)
      await client.rpc("release_ticket_order", {
        target_order_id: orderId,
        final_status: "cancelled",
      });
    console.error("Unable to start ticket checkout:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to start secure ticket checkout.",
      },
      { status: 500 },
    );
  }
}

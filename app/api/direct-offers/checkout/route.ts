import { z } from "zod";
import { getAppUser } from "@/lib/auth";
import { paymentAccount } from "@/lib/payments";
import { stripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { rateLimitResponse, trustedMutationOrigin } from "@/lib/security/rate-limit";

const schema = z.object({
  offerId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  email: z.string().email().max(320),
  quantity: z.number().int().min(1).max(20),
  termsVersion: z.string().min(1).max(80),
  termsAccepted: z.literal(true),
});
export async function POST(request: Request) {
  try {
    if (!trustedMutationOrigin(request))
      return Response.json({ error: "Invalid origin." }, { status: 403 });
    const limited = await rateLimitResponse(request, { bucket: "direct-offer-checkout", limit: 10, windowSeconds: 60 });
    if (limited) return limited;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        {
          error: "Complete the purchaser details and accept the package terms.",
        },
        { status: 400 },
      );
    const input = parsed.data,
      client = createSupabaseAdminClient(),
      user = await getAppUser();
    const recent = await client
      .from("direct_offer_orders")
      .select("id", { count: "exact", head: true })
      .eq("purchaser_email", input.email.toLowerCase())
      .gte("created_at", new Date(Date.now() - 60_000).toISOString());
    if ((recent.count || 0) >= 5)
      return Response.json(
        { error: "Please wait before starting another checkout." },
        { status: 429 },
      );
    const { data: orderId, error: reserveError } = await client.rpc(
      "reserve_direct_offer_order",
      {
        target_offer_id: input.offerId,
        buyer_name: input.name,
        buyer_email: input.email,
        purchase_quantity: input.quantity,
        buyer_user_id: user?.provider === "supabase" ? user.userId : null,
        accepted_terms_version: input.termsVersion,
      },
    );
    if (reserveError || !orderId)
      return Response.json(
        {
          error: reserveError?.message?.includes("sold out")
            ? "This offer no longer has enough availability."
            : "This offer changed or is no longer available.",
        },
        { status: 409 },
      );
    try {
      const { data: order, error } = await client
        .from("direct_offer_orders")
        .select("*,direct_offers(title,slug,organization_id,package_snapshot)")
        .eq("id", orderId)
        .single();
      if (error || !order) throw error || Error("Order not found");
      const offer = Array.isArray(order.direct_offers)
        ? order.direct_offers[0]
        : order.direct_offers;
      const connected = await paymentAccount(order.organization_id);
      if (!connected || connected.status !== "ready")
        throw Error("The nonprofit payment account is not ready.");
      const applicationFeeCents =
        Number(order.package_cost_cents) + Number(order.platform_fee_cents);
      if (applicationFeeCents > Number(order.gross_cents))
        throw Error("Offer pricing requires review.");
      const origin = new URL(request.url).origin;
      const session = await stripe().checkout.sessions.create(
        {
          mode: "payment",
          customer_email: input.email,
          line_items: [
            {
              price_data: {
                currency: order.currency,
                unit_amount: order.unit_price_cents,
                product_data: {
                  name: offer?.title || "Give Holidays fundraising experience",
                  description: `Supports a nonprofit through Give Holidays · ${String(offer?.package_snapshot?.destination || "Travel experience")}`,
                },
              },
              quantity: order.quantity,
            },
          ],
          payment_intent_data: {
            application_fee_amount: applicationFeeCents,
            metadata: {
              gather_direct_offer_order_id: order.id,
              gather_direct_offer_id: order.offer_id,
            },
          },
          metadata: {
            gather_direct_offer_order_id: order.id,
            gather_transaction_type: "direct_offer",
          },
          success_url: `${origin}/offers/${offer?.slug}?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/offers/${offer?.slug}?purchase=cancelled`,
          custom_text: {
            submit: {
              message:
                "Your purchase supports the nonprofit. It is a travel purchase and is not represented as fully tax-deductible.",
            },
          },
        },
        {
          stripeAccount: connected.stripeAccountId,
          idempotencyKey: `direct-offer-${order.id}`,
        },
      );
      if (!session.url) throw Error("Stripe did not return a checkout link.");
      await client
        .from("direct_offer_orders")
        .update({
          status: "checkout_open",
          stripe_checkout_session_id: session.id,
          connected_account_id: connected.stripeAccountId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
      return Response.json({ url: session.url });
    } catch (error) {
      await client.rpc("release_direct_offer_order", {
        target_order_id: orderId,
        final_status: "cancelled",
      });
      throw error;
    }
  } catch (error) {
    console.error("Unable to start direct offer checkout:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to start secure checkout.",
      },
      { status: 500 },
    );
  }
}

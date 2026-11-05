import type Stripe from "stripe";
import { createSupabaseAdminClient } from "./admin";
import {
  money,
  safelySendTrackedTemplateEmail,
} from "@/lib/email/notifications";
import { stripe } from "@/lib/stripe";
import { sendInvoiceReceipt } from "./receipts";
import {
  recordSupporterActivity,
  supporterIdentity,
  type SupporterActivityType,
} from "./supporters";
import { sendTemplateEmail } from "@/lib/email/resend";

async function paymentDetails(
  paymentIntentId: string,
  account?: string | null,
) {
  try {
    const intent = await stripe().paymentIntents.retrieve(
      paymentIntentId,
      { expand: ["latest_charge.balance_transaction"] },
      account ? { stripeAccount: account } : undefined,
    );
    const charge =
      typeof intent.latest_charge === "string" ? null : intent.latest_charge;
    const balance =
      charge && typeof charge.balance_transaction !== "string"
        ? charge.balance_transaction
        : null;
    return {
      chargeId: charge?.id || null,
      processingFeeCents: Number(balance?.fee || 0),
    };
  } catch (error) {
    console.warn(
      "Unable to load Stripe processing fee details:",
      error instanceof Error ? error.message : error,
    );
    return { chargeId: null, processingFeeCents: 0 };
  }
}

async function recordInvoiceActivity(
  invoiceId: string,
  type: SupporterActivityType,
  dedupeKey: string,
  amountCents?: number,
  metadata?: Record<string, unknown>,
) {
  const client = createSupabaseAdminClient();
  const { data: invoice } = await client
    .from("winner_invoices")
    .select("id,payer_id,auction_id,total_due_cents,auctions(organization_id)")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return;
  const auction = Array.isArray(invoice.auctions)
    ? invoice.auctions[0]
    : invoice.auctions;
  if (!auction?.organization_id) return;
  const identity = await supporterIdentity(invoice.payer_id);
  await recordSupporterActivity({
    organizationId: auction.organization_id,
    userId: invoice.payer_id,
    email: identity.email,
    fullName: identity.fullName,
    source: "payment",
    type,
    dedupeKey,
    auctionId: invoice.auction_id,
    invoiceId: invoice.id,
    amountCents: amountCents ?? Number(invoice.total_due_cents || 0),
    metadata,
  });
}

export async function processStripeEvent(event: Stripe.Event) {
  const client = createSupabaseAdminClient();
  const object = event.data.object as { id?: string };
  const base = {
    id: event.id,
    type: event.type,
    object_id: object.id || null,
    connected_account_id: event.account || null,
    livemode: event.livemode,
    stripe_created_at: new Date(event.created * 1000).toISOString(),
    status: "processing",
  };
  await client.from("stripe_webhook_events").upsert(base, { onConflict: "id" });
  try {
    if (
      [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
      ].includes(event.type)
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const directOfferOrderId = session.metadata?.gather_direct_offer_order_id;
      if (directOfferOrderId && session.payment_status === "paid") {
        const paymentIntent =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;
        const details = paymentIntent
          ? await paymentDetails(paymentIntent, event.account)
          : { chargeId: null, processingFeeCents: 0 };
        const { error: completeError } = await client.rpc(
          "complete_direct_offer_order",
          {
            target_order_id: directOfferOrderId,
            checkout_session_id: session.id,
            payment_intent_id: paymentIntent || "",
            charge_id: details.chargeId || "",
            processor_fee: details.processingFeeCents,
          },
        );
        if (completeError) throw completeError;
        const { data: order, error: orderError } = await client
          .from("direct_offer_orders")
          .select(
            "*,direct_offers(slug,title,package_snapshot,organizations(display_name))",
          )
          .eq("id", directOfferOrderId)
          .single();
        if (orderError) throw orderError;
        const offer = Array.isArray(order.direct_offers)
          ? order.direct_offers[0]
          : order.direct_offers;
        const organization = Array.isArray(offer?.organizations)
          ? offer.organizations[0]
          : offer?.organizations;
        const origin = (
          process.env.APP_URL || "https://gatherforgood.bid"
        ).replace(/\/$/, "");
        await sendTemplateEmail({
          to: order.purchaser_email,
          templateId: "direct-offer-welcome",
          values: {
            organizationName: organization?.display_name || "the nonprofit",
            guestName: order.purchaser_name,
            packageTitle: offer?.title || "Give Holidays experience",
            receiptNumber:
              order.receipt_number ||
              `GDO-${order.id.slice(0, 8).toUpperCase()}`,
            amountPaid: money(Number(order.gross_cents || 0)),
            quantity: String(order.quantity),
            offerUrl: `${origin}/offers/${offer?.slug || ""}`,
          },
          idempotencyKey: `direct-offer-welcome-${order.id}`,
        });
        await recordSupporterActivity({
          organizationId: order.organization_id,
          userId: order.purchaser_user_id,
          email: order.purchaser_email,
          fullName: order.purchaser_name,
          source: "payment",
          type: "direct_offer_purchased",
          dedupeKey: `direct-offer-order-${order.id}`,
          directOfferOrderId: order.id,
          amountCents: Number(order.fundraising_proceeds_cents || 0),
          metadata: {
            grossCents: order.gross_cents,
            fundraisingProceedsCents: order.fundraising_proceeds_cents,
            packageCostCents: order.package_cost_cents,
            transactionClass: "direct_offer",
          },
        });
      }
      const ticketOrderId = session.metadata?.gather_ticket_order_id;
      if (ticketOrderId && session.payment_status === "paid") {
        const paymentIntent =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;
        const details = paymentIntent
          ? await paymentDetails(paymentIntent, event.account)
          : { chargeId: null, processingFeeCents: 0 };
        const { error: completeError } = await client.rpc(
          "complete_ticket_order",
          {
            target_order_id: ticketOrderId,
            checkout_session_id: session.id,
            payment_intent_id: paymentIntent || "",
            charge_id: details.chargeId || "",
            processor_fee: details.processingFeeCents,
          },
        );
        if (completeError) throw completeError;
        const { data: ticketOrder, error: ticketOrderError } = await client
          .from("ticket_orders")
          .select(
            "id,organization_id,auction_id,purchaser_user_id,purchaser_name,purchaser_email,total_cents",
          )
          .eq("id", ticketOrderId)
          .single();
        if (ticketOrderError) throw ticketOrderError;
        await recordSupporterActivity({
          organizationId: ticketOrder.organization_id,
          userId: ticketOrder.purchaser_user_id,
          email: ticketOrder.purchaser_email,
          fullName: ticketOrder.purchaser_name,
          source: "payment",
          type: "ticket_purchased",
          dedupeKey: `ticket-order-${ticketOrder.id}`,
          auctionId: ticketOrder.auction_id,
          ticketOrderId: ticketOrder.id,
          amountCents: Number(ticketOrder.total_cents || 0),
          metadata: { transactionClass: "ticket_sale" },
        });
      }
      const invoiceId = session.metadata?.gather_invoice_id;
      if (invoiceId && session.payment_status === "paid") {
        const paymentIntent =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;
        const details = paymentIntent
          ? await paymentDetails(paymentIntent, event.account)
          : { chargeId: null, processingFeeCents: 0 };
        const receiptNumber = `GTH-${invoiceId.slice(0, 8).toUpperCase()}`;
        const { error } = await client
          .from("winner_invoices")
          .update({
            status: "paid",
            last_payment_status: "paid",
            last_payment_error: null,
            stripe_payment_intent_id: paymentIntent || null,
            stripe_charge_id: details.chargeId,
            processing_fee_cents: details.processingFeeCents,
            receipt_number: receiptNumber,
            paid_at: new Date().toISOString(),
          })
          .eq("id", invoiceId)
          .eq("stripe_checkout_session_id", session.id);
        if (error) throw error;
        const { error: fulfillmentError } = await client.rpc(
          "activate_paid_fulfillments",
          { target_invoice_id: invoiceId },
        );
        if (fulfillmentError) throw fulfillmentError;
        const { data: invoice, error: invoiceError } = await client
          .from("winner_invoices")
          .select(
            `
          id,payer_id,auction_id,total_due_cents,paid_at,
          winner_invoice_items(auction_items(title,source,travel_package_snapshot),fulfillments(id,status))
        `,
          )
          .eq("id", invoiceId)
          .single();
        if (invoiceError) throw invoiceError;
        const origin = (
          process.env.APP_URL || "https://gatherforgood.bid"
        ).replace(/\/$/, "");
        const receipt = await sendInvoiceReceipt(invoice.id);
        await recordInvoiceActivity(
          invoice.id,
          "payment_completed",
          `payment-${paymentIntent || session.id}`,
          Number(invoice.total_due_cents || 0),
          { stripePaymentIntentId: paymentIntent || null },
        );
        await recordInvoiceActivity(
          invoice.id,
          "receipt_sent",
          `receipt-${receipt.receiptNumber}`,
          Number(invoice.total_due_cents || 0),
          { receiptNumber: receipt.receiptNumber },
        );
        for (const line of invoice.winner_invoice_items || []) {
          const item = Array.isArray(line.auction_items)
            ? line.auction_items[0]
            : line.auction_items;
          const fulfillment = Array.isArray(line.fulfillments)
            ? line.fulfillments[0]
            : line.fulfillments;
          if (item?.source !== "give_holidays" || !fulfillment) continue;
          const terms = (item.travel_package_snapshot || {}) as Record<
            string,
            unknown
          >;
          await safelySendTrackedTemplateEmail({
            userId: invoice.payer_id,
            auctionId: invoice.auction_id,
            templateId: "travel-details-needed",
            dedupeKey: `travel-details-needed-${fulfillment.id}`,
            values: {
              packageTitle: item.title || "Give Holidays experience",
              destination: String(terms.destination || "See package details"),
              staySummary:
                [terms.stayLength, terms.occupancy]
                  .filter(Boolean)
                  .map(String)
                  .join(" · ") || "See package details",
              expirationDate: String(
                terms.expirationDate || "See package terms",
              ),
              claimUrl: `${origin}/my-wins`,
            },
          });
        }
      }
    } else if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const directOfferOrderId = session.metadata?.gather_direct_offer_order_id;
      if (directOfferOrderId)
        await client.rpc("release_direct_offer_order", {
          target_order_id: directOfferOrderId,
          final_status: "failed",
        });
      const ticketOrderId = session.metadata?.gather_ticket_order_id;
      if (ticketOrderId)
        await client.rpc("release_ticket_order", {
          target_order_id: ticketOrderId,
          final_status: "failed",
        });
      const invoiceId = session.metadata?.gather_invoice_id;
      if (invoiceId) {
        await client
          .from("winner_invoices")
          .update({
            status: "open",
            last_payment_status: "failed",
            last_payment_error:
              "Stripe reported that the asynchronous payment failed.",
            stripe_checkout_session_id: null,
          })
          .eq("id", invoiceId);
        await recordInvoiceActivity(
          invoiceId,
          "payment_failed",
          `payment-failed-${event.id}`,
          undefined,
          { stripeEventId: event.id },
        );
      }
    } else if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const invoiceId = intent.metadata?.gather_invoice_id;
      if (invoiceId) {
        const details = await paymentDetails(intent.id, event.account);
        await client
          .from("winner_invoices")
          .update({
            stripe_payment_intent_id: intent.id,
            stripe_charge_id: details.chargeId,
            processing_fee_cents: details.processingFeeCents,
            last_payment_status: "pending",
          })
          .eq("id", invoiceId)
          .neq("status", "paid");
      }
    } else if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const invoiceId = intent.metadata?.gather_invoice_id;
      if (invoiceId) {
        await client
          .from("winner_invoices")
          .update({
            status: "open",
            last_payment_status: "failed",
            last_payment_error:
              intent.last_payment_error?.message?.slice(0, 1000) ||
              "Payment failed.",
          })
          .eq("id", invoiceId);
        await recordInvoiceActivity(
          invoiceId,
          "payment_failed",
          `payment-failed-${event.id}`,
          intent.amount,
          { stripeEventId: event.id },
        );
      }
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (paymentIntentId) {
        const { data: invoice, error: invoiceError } = await client
          .from("winner_invoices")
          .select("id,payer_id,auction_id,total_due_cents")
          .eq("stripe_payment_intent_id", paymentIntentId)
          .maybeSingle();
        if (invoiceError) throw invoiceError;
        if (invoice) {
          for (const refund of charge.refunds?.data || []) {
            const { error: refundError } = await client
              .from("payment_refunds")
              .upsert(
                {
                  invoice_id: invoice.id,
                  amount_cents: refund.amount,
                  reason: refund.reason || "Stripe refund",
                  stripe_refund_id: refund.id,
                  status:
                    refund.status === "succeeded"
                      ? "succeeded"
                      : refund.status === "failed"
                        ? "failed"
                        : "pending",
                },
                { onConflict: "stripe_refund_id" },
              );
            if (refundError) throw refundError;
            if (refund.status === "succeeded")
              await safelySendTrackedTemplateEmail({
                userId: invoice.payer_id,
                auctionId: invoice.auction_id,
                templateId: "refund",
                dedupeKey: `refund-${refund.id}`,
                values: {
                  itemOrInvoice: `Gather invoice ${invoice.id.slice(0, 8).toUpperCase()}`,
                  refundAmount: money(refund.amount),
                  refundReference: refund.id,
                  refundReason: refund.reason || "Organizer-approved refund",
                  myWinsUrl: `${(process.env.APP_URL || "https://gatherforgood.bid").replace(/\/$/, "")}/my-wins`,
                },
              });
            if (refund.status === "succeeded")
              await recordInvoiceActivity(
                invoice.id,
                charge.refunded
                  ? "payment_refunded"
                  : "payment_partially_refunded",
                `refund-${refund.id}`,
                refund.amount,
                { stripeRefundId: refund.id, reason: refund.reason },
              );
          }
          const { data: refundRows, error: refundsError } = await client
            .from("payment_refunds")
            .select("amount_cents")
            .eq("invoice_id", invoice.id)
            .eq("status", "succeeded");
          if (refundsError) throw refundsError;
          const refunded = (refundRows || []).reduce(
            (sum, refund) => sum + Number(refund.amount_cents || 0),
            0,
          );
          const fullyRefunded =
            refunded >= Number(invoice.total_due_cents || 0);
          await client
            .from("winner_invoices")
            .update({
              status: fullyRefunded ? "refunded" : "partially_refunded",
              last_payment_status: fullyRefunded
                ? "refunded"
                : "partially_refunded",
            })
            .eq("id", invoice.id);
        } else {
          const { data: order, error: orderError } = await client
            .from("direct_offer_orders")
            .select("*")
            .eq("stripe_payment_intent_id", paymentIntentId)
            .maybeSingle();
          if (orderError) throw orderError;
          if (order) {
            for (const refund of charge.refunds?.data || []) {
              const { error: refundError } = await client
                .from("direct_offer_refunds")
                .upsert(
                  {
                    order_id: order.id,
                    stripe_refund_id: refund.id,
                    amount_cents: refund.amount,
                    status:
                      refund.status === "succeeded"
                        ? "succeeded"
                        : refund.status === "failed"
                          ? "failed"
                          : "pending",
                    reason: refund.reason || "Refund",
                  },
                  { onConflict: "stripe_refund_id" },
                );
              if (refundError) throw refundError;
            }
            const { data: refunds } = await client
              .from("direct_offer_refunds")
              .select("amount_cents")
              .eq("order_id", order.id)
              .eq("status", "succeeded");
            const totalRefunded = (refunds || []).reduce(
              (sum, refund) => sum + Number(refund.amount_cents || 0),
              0,
            );
            const full = totalRefunded >= Number(order.gross_cents || 0);
            await client
              .from("direct_offer_orders")
              .update({
                status: full ? "refunded" : "partially_refunded",
                updated_at: new Date().toISOString(),
              })
              .eq("id", order.id);
            if (full)
              await client
                .from("direct_offer_fulfillments")
                .update({
                  status: "refunded",
                  updated_at: new Date().toISOString(),
                })
                .eq("order_id", order.id);
            await recordSupporterActivity({
              organizationId: order.organization_id,
              userId: order.purchaser_user_id,
              email: order.purchaser_email,
              fullName: order.purchaser_name,
              source: "payment",
              type: "direct_offer_refunded",
              dedupeKey: `direct-offer-refund-${event.id}`,
              directOfferOrderId: order.id,
              amountCents: totalRefunded,
              metadata: { grossCents: order.gross_cents, fullyRefunded: full },
            });
          }
        }
      }
    }
    await client
      .from("stripe_webhook_events")
      .update({
        status: "processed",
        processed_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", event.id);
  } catch (error) {
    await client
      .from("stripe_webhook_events")
      .update({
        status: "failed",
        last_error:
          error instanceof Error
            ? error.message.slice(0, 1000)
            : "Unknown processing error",
      })
      .eq("id", event.id);
    throw error;
  }
}

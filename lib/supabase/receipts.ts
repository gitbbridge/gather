import {
  dateTime,
  money,
  sendTrackedTemplateEmail,
} from "@/lib/email/notifications";
import { createSupabaseAdminClient } from "./admin";
import { recordSupporterActivity } from "./supporters";
import { resolveReceiptCopy } from "@/lib/message-rules";

const first = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] || null : value || null;

export async function sendInvoiceReceipt(
  invoiceId: string,
  options: { resend?: boolean } = {},
) {
  const client = createSupabaseAdminClient();
  const { data: invoice, error } = await client
    .from("winner_invoices")
    .select(
      `
    id,payer_id,auction_id,status,total_due_cents,hammer_subtotal_cents,bidder_platform_fee_cents,
    processing_fee_cents,stripe_payment_intent_id,paid_at,receipt_number,
    auctions(name,organization_id,organizations(display_name)),
    winner_invoice_items(hammer_price_cents,auction_items(title,source))
  `,
    )
    .eq("id", invoiceId)
    .single();
  if (error || !invoice) throw error || new Error("Invoice not found.");
  if (!["paid", "partially_refunded", "refunded"].includes(invoice.status))
    throw new Error(
      "A receipt can only be sent for a confirmed paid transaction.",
    );
  const { data: authData, error: authError } =
    await client.auth.admin.getUserById(invoice.payer_id);
  if (authError || !authData.user?.email)
    throw authError || new Error("Winner email not found.");
  const auction = first(invoice.auctions);
  const organization = first(auction?.organizations);
  const organizationId = auction?.organization_id;
  const [{ data: emailSettings }, { data: auctionOverride }] = organizationId
    ? await Promise.all([
        client
          .from("organization_email_settings")
          .select("*")
          .eq("organization_id", organizationId)
          .maybeSingle(),
        client
          .from("auction_email_overrides")
          .select("*")
          .eq("auction_id", invoice.auction_id)
          .maybeSingle(),
      ])
    : [{ data: null }, { data: null }];
  const receiptCopy = resolveReceiptCopy(
    {
      thankYouHeading:
        emailSettings?.thank_you_heading || "Thank you for your support",
      thankYouMessage:
        emailSettings?.thank_you_message ||
        "Your generosity makes this work possible.",
      receiptFooter:
        emailSettings?.receipt_footer || "Keep this receipt for your records.",
    },
    auctionOverride
      ? {
          inheritsDefaults: auctionOverride.inherits_defaults,
          thankYouHeading: auctionOverride.thank_you_heading,
          thankYouMessage: auctionOverride.thank_you_message,
          receiptFooter: auctionOverride.receipt_footer,
        }
      : null,
  );
  const lines = invoice.winner_invoice_items || [];
  const hasTravel = lines.some(
    (line) => first(line.auction_items)?.source === "give_holidays",
  );
  const hasStandard = lines.some(
    (line) => first(line.auction_items)?.source !== "give_holidays",
  );
  const receiptNumber =
    invoice.receipt_number || `GTH-${invoice.id.slice(0, 8).toUpperCase()}`;
  const now = new Date().toISOString();
  const result = await sendTrackedTemplateEmail({
    userId: invoice.payer_id,
    recipientEmail: authData.user.email,
    auctionId: invoice.auction_id,
    templateId: "payment-receipt",
    dedupeKey: options.resend
      ? `payment-receipt-resend-${invoice.id}-${crypto.randomUUID()}`
      : `payment-receipt-${invoice.id}`,
    replyTo: emailSettings?.reply_to_verified_at
      ? emailSettings.reply_to_email || undefined
      : undefined,
    values: {
      auctionName: auction?.name || "Auction",
      organizationName: organization?.display_name || "the nonprofit",
      thankYouHeading: receiptCopy.thankYouHeading,
      thankYouMessage: receiptCopy.thankYouMessage,
      receiptFooter: receiptCopy.receiptFooter,
      bidderName:
        typeof authData.user.user_metadata?.full_name === "string"
          ? authData.user.user_metadata.full_name
          : authData.user.email,
      bidderEmail: authData.user.email,
      receiptNumber,
      itemSummary: lines
        .map(
          (line) =>
            `${first(line.auction_items)?.title || "Auction item"} — ${money(Number(line.hammer_price_cents || 0))}`,
        )
        .join("; "),
      hammerSubtotal: money(Number(invoice.hammer_subtotal_cents || 0)),
      bidderFee: money(Number(invoice.bidder_platform_fee_cents || 0)),
      processingFee: Number(invoice.processing_fee_cents || 0)
        ? `${money(Number(invoice.processing_fee_cents))} (paid by nonprofit)`
        : "$0.00",
      amountPaid: money(Number(invoice.total_due_cents || 0)),
      paymentStatus:
        invoice.status === "paid"
          ? "Paid"
          : invoice.status.replaceAll("_", " "),
      transactionId:
        invoice.stripe_payment_intent_id || "Stripe confirmation pending",
      paidAt: dateTime(invoice.paid_at || now),
      paymentMethod: "Stripe checkout",
      fulfillmentInstructions: [
        hasStandard
          ? "The nonprofit will provide pickup or fulfillment details for standard auction items."
          : "",
        hasTravel
          ? "Give Holidays will contact you after the paid travel experience is released for fulfillment."
          : "",
      ]
        .filter(Boolean)
        .join(" "),
      myWinsUrl: `${(process.env.APP_URL || "https://gatherforgood.bid").replace(/\/$/, "")}/my-wins`,
    },
  });
  await client
    .from("winner_invoices")
    .update({
      receipt_number: receiptNumber,
      receipt_provider_reference: result.id,
      last_receipt_sent_at: now,
      ...(!options.resend ? { automatic_receipt_sent_at: now } : {}),
    })
    .eq("id", invoice.id);
  if (auction?.organization_id)
    await recordSupporterActivity({
      organizationId: auction.organization_id,
      userId: invoice.payer_id,
      email: authData.user.email,
      fullName:
        typeof authData.user.user_metadata?.full_name === "string"
          ? authData.user.user_metadata.full_name
          : authData.user.email,
      source: "payment",
      type: "receipt_sent",
      dedupeKey: options.resend
        ? `receipt-resend-${result.id}`
        : `receipt-${receiptNumber}`,
      auctionId: invoice.auction_id,
      invoiceId: invoice.id,
      amountCents: Number(invoice.total_due_cents || 0),
      metadata: {
        receiptNumber,
        providerReference: result.id,
        resend: Boolean(options.resend),
      },
    });
  return {
    receiptNumber,
    providerReference: result.id,
    duplicate: result.duplicate,
  };
}

import { createSupabaseAdminClient } from "./admin";

export type SupporterSource =
  | "manual"
  | "csv_import"
  | "auction_registration"
  | "bidder_activity"
  | "auction_winner"
  | "payment"
  | "historical_import";
export type SupporterActivityType =
  | "auction_registration"
  | "bid_placed"
  | "item_won"
  | "payment_completed"
  | "payment_failed"
  | "payment_refunded"
  | "payment_partially_refunded"
  | "receipt_sent"
  | "travel_package_selected"
  | "fulfillment_status_changed"
  | "internal_note_added"
  | "tag_added"
  | "tag_removed"
  | "historical_contribution"
  | "direct_offer_purchased"
  | "direct_offer_refunded"
  | "direct_offer_fulfillment_status_changed"
  | "ticket_purchased"
  | "ticket_refunded"
  | "event_attended";

export const normalizedEmail = (value: string) => value.trim().toLowerCase();

export async function upsertSupporter(input: {
  organizationId: string;
  userId?: string | null;
  email: string;
  fullName?: string | null;
  phone?: string | null;
  mailingAddress?: Record<string, string>;
  tags?: string[];
  source: SupporterSource;
}) {
  const client = createSupabaseAdminClient();
  const email = normalizedEmail(input.email);
  if (!/^\S+@\S+\.\S+$/.test(email))
    throw new Error("A valid supporter email is required.");
  const { data: existing, error: existingError } = await client
    .from("supporters")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("normalized_email", email)
    .maybeSingle();
  if (existingError) throw existingError;
  const now = new Date().toISOString();
  if (existing) {
    const tags = [
      ...new Set([...(existing.tags || []), ...(input.tags || [])]),
    ];
    const { data, error } = await client
      .from("supporters")
      .update({
        user_id: input.userId || existing.user_id,
        email: input.email.trim(),
        full_name: input.fullName?.trim() || existing.full_name,
        phone: input.phone?.trim() || existing.phone,
        mailing_address:
          input.mailingAddress && Object.keys(input.mailingAddress).length
            ? input.mailingAddress
            : existing.mailing_address,
        tags,
        last_activity_at: now,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await client
    .from("supporters")
    .insert({
      organization_id: input.organizationId,
      user_id: input.userId || null,
      normalized_email: email,
      email: input.email.trim(),
      full_name: input.fullName?.trim() || "",
      phone: input.phone?.trim() || null,
      mailing_address: input.mailingAddress || {},
      tags: input.tags || [],
      record_source: input.source,
      last_activity_at: now,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function recordSupporterActivity(input: {
  organizationId: string;
  userId?: string | null;
  email: string;
  fullName?: string | null;
  source: SupporterSource;
  type: SupporterActivityType;
  dedupeKey: string;
  auctionId?: string | null;
  itemId?: string | null;
  invoiceId?: string | null;
  fulfillmentId?: string | null;
  directOfferOrderId?: string | null;
  ticketOrderId?: string | null;
  amountCents?: number | null;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
}) {
  const client = createSupabaseAdminClient();
  const supporter = await upsertSupporter(input);
  const { error } = await client.from("supporter_activities").upsert(
    {
      supporter_id: supporter.id,
      organization_id: input.organizationId,
      activity_type: input.type,
      auction_id: input.auctionId || null,
      item_id: input.itemId || null,
      invoice_id: input.invoiceId || null,
      fulfillment_id: input.fulfillmentId || null,
      amount_cents: input.amountCents ?? null,
      direct_offer_order_id: input.directOfferOrderId || null,
      ticket_order_id: input.ticketOrderId || null,
      occurred_at: input.occurredAt || new Date().toISOString(),
      dedupe_key: input.dedupeKey,
      metadata: input.metadata || {},
    },
    { onConflict: "organization_id,dedupe_key", ignoreDuplicates: true },
  );
  if (error) throw error;
  return supporter;
}

export async function supporterIdentity(userId: string) {
  const { data, error } =
    await createSupabaseAdminClient().auth.admin.getUserById(userId);
  if (error || !data.user?.email)
    throw error || new Error("Supporter identity is unavailable.");
  return {
    email: data.user.email,
    fullName:
      typeof data.user.user_metadata?.full_name === "string"
        ? data.user.user_metadata.full_name
        : data.user.email,
  };
}

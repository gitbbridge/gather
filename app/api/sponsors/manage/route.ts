import { z } from "zod";
import { managedAuction } from "@/lib/organizer-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  coverageLabel,
  defaultSponsorTiers,
  hashPortalToken,
  randomPortalToken,
  safeSponsorWebsite,
} from "@/lib/sponsors";
import { sendTemplateEmail } from "@/lib/email/resend";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
const uuid = z.string().uuid();
const coverage = z.enum(["platform", "processing", "both"]);
const base = z.object({ organizationId: uuid, auctionId: uuid });
const input = z.discriminatedUnion("action", [
  base.extend({
    action: z.literal("save_tier"),
    id: uuid.optional(),
    name: z.string().trim().min(2).max(80),
    displayRank: z.number().int().min(0).max(10000),
    displayStyle: z.enum(["presenting", "prominent", "compact"]),
    isVisible: z.boolean(),
  }),
  base.extend({
    action: z.literal("save_sponsor"),
    eventSponsorId: uuid.optional(),
    sponsorBusinessId: uuid.optional(),
    businessName: z.string().trim().min(2).max(160),
    logoUrl: z.string().trim().max(1000).optional(),
    websiteUrl: z.string().trim().max(1000).optional(),
    description: z.string().trim().max(1200).default(""),
    contactName: z.string().trim().max(120).optional(),
    contactEmail: z.string().email().optional().or(z.literal("")),
    contactPhone: z.string().trim().max(40).optional(),
    internalNotes: z.string().trim().max(4000).default(""),
    tierId: uuid,
    commitmentCents: z.number().int().min(0).max(100_000_000),
    publicRecognitionEnabled: z.boolean(),
    displayOrder: z.number().int().min(0).max(10000),
    status: z.enum(["active", "inactive", "archived"]),
  }),
  base.extend({
    action: z.literal("assign_item"),
    eventSponsorId: uuid,
    auctionItemId: uuid,
    enabled: z.boolean(),
  }),
  base.extend({
    action: z.literal("invite_fee_sponsor"),
    eventSponsorId: uuid,
    contactName: z.string().trim().min(2).max(120),
    contactEmail: z.string().email(),
    requestedCoverage: coverage,
    proposedMaximumCents: z.number().int().min(100).max(100_000_000),
    coverageStartsAt: z.string().datetime().nullable().optional(),
    coverageEndsAt: z.string().datetime().nullable().optional(),
    recognitionRequested: z.boolean(),
    invitationMessage: z.string().trim().max(2000).default(""),
  }),
  base.extend({ action: z.literal("resend_invitation"), invitationId: uuid }),
  base.extend({ action: z.literal("revoke_invitation"), invitationId: uuid }),
  base.extend({ action: z.literal("approve_counteroffer"), invitationId: uuid }),
  base.extend({
    action: z.literal("save_recognition"),
    donationReceipts: z.boolean(),
    winningBidConfirmations: z.boolean(),
    purchaseConfirmations: z.boolean(),
    ticketConfirmations: z.boolean(),
    showSponsorName: z.boolean(),
    showSponsorLogo: z.boolean(),
    showPublicEventPage: z.boolean(),
  }),
  base.extend({ action: z.literal("create_statement"), agreementId: uuid }),
  base.extend({ action: z.literal("charge_statement"), statementId: uuid }),
]);

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });

async function access(organizationId: string, auctionId: string) {
  const managed = await managedAuction(auctionId);
  return managed?.nonprofit?.id === organizationId ? managed : null;
}

async function seedTiers(organizationId: string, auctionId: string) {
  const client = createSupabaseAdminClient();
  const { data } = await client
    .from("sponsorship_tiers")
    .select("id")
    .eq("auction_id", auctionId)
    .limit(1);
  if (data?.length) return;
  const { error } = await client.from("sponsorship_tiers").insert(
    defaultSponsorTiers.map((tier) => ({
      organization_id: organizationId,
      auction_id: auctionId,
      name: tier.name,
      display_rank: tier.rank,
      display_style: tier.style,
      is_visible: true,
    })),
  );
  if (error && error.code !== "23505") throw error;
}

async function invitationEmail(invitationId: string, rawToken: string) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("fee_sponsorship_invitations")
    .select(
      "*,auctions(name),organizations(display_name),event_sponsors(sponsor_businesses(business_name))",
    )
    .eq("id", invitationId)
    .single();
  if (error) throw error;
  const auction = Array.isArray(data.auctions) ? data.auctions[0] : data.auctions;
  const organization = Array.isArray(data.organizations)
    ? data.organizations[0]
    : data.organizations;
  const eventSponsor = Array.isArray(data.event_sponsors)
    ? data.event_sponsors[0]
    : data.event_sponsors;
  const business = Array.isArray(eventSponsor?.sponsor_businesses)
    ? eventSponsor.sponsor_businesses[0]
    : eventSponsor?.sponsor_businesses;
  const origin = (process.env.APP_URL || "https://gatherforgood.bid").replace(/\/$/, "");
  await sendTemplateEmail({
    to: data.contact_email,
    templateId: "sponsor-fee-invitation",
    values: {
      sponsorContactName: data.contact_name,
      organizationName: organization?.display_name || "the nonprofit",
      sponsorBusinessName: business?.business_name || "your business",
      auctionName: auction?.name || "the event",
      coverageLabel: coverageLabel(data.requested_coverage),
      maximumCommitment: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(data.proposed_maximum_cents / 100),
      coveragePeriod:
        data.coverage_starts_at || data.coverage_ends_at
          ? `${data.coverage_starts_at ? new Date(data.coverage_starts_at).toLocaleDateString() : "Event start"} – ${data.coverage_ends_at ? new Date(data.coverage_ends_at).toLocaleDateString() : "Event closeout"}`
          : "Through event closeout",
      invitationMessage:
        data.invitation_message || "We would be honored to recognize your support.",
      invitationUrl: `${origin}/sponsor/invitation/${rawToken}`,
    },
    idempotencyKey: `sponsor-invitation-${data.id}-${Date.now()}`,
  });
  await client
    .from("fee_sponsorship_invitations")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", data.id);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organization") || "";
    const auctionId = url.searchParams.get("auction") || "";
    if (!uuid.safeParse(organizationId).success || !uuid.safeParse(auctionId).success)
      return json({ error: "Open Sponsors from an event dashboard." }, 400);
    const managed = await access(organizationId, auctionId);
    if (!managed) return json({ error: "Access denied." }, 403);
    await seedTiers(organizationId, auctionId);
    const client = createSupabaseAdminClient();
    const [tiers, sponsors, invitations, agreements, recognition, items, statements] =
      await Promise.all([
        client.from("sponsorship_tiers").select("*").eq("auction_id", auctionId).order("display_rank"),
        client
          .from("event_sponsors")
          .select("*,sponsor_businesses(*),sponsorship_tiers(*),auction_item_sponsors(auction_item_id,recognition_enabled)")
          .eq("auction_id", auctionId)
          .order("display_order"),
        client
          .from("fee_sponsorship_invitations")
          .select("*")
          .eq("auction_id", auctionId)
          .order("created_at", { ascending: false }),
        client
          .from("fee_sponsorship_agreements")
          .select("*,event_sponsors(sponsor_businesses(business_name,logo_url)),fee_sponsorship_allocations(*),sponsor_billing_statements(*)")
          .eq("auction_id", auctionId)
          .order("created_at", { ascending: false }),
        client.from("fee_sponsorship_recognition").select("*").eq("auction_id", auctionId).maybeSingle(),
        client.from("auction_items").select("id,title").eq("auction_id", auctionId).order("position"),
        client.from("sponsor_billing_statements").select("*").eq("auction_id", auctionId).order("created_at", { ascending: false }),
      ]);
    const failure = [tiers, sponsors, invitations, agreements, recognition, items, statements].find(
      (result) => result.error,
    );
    if (failure?.error) throw failure.error;
    return json({
      auction: { id: auctionId, name: managed.auction.name, ends: managed.auction.ends },
      organization: { id: organizationId, name: managed.nonprofit?.name },
      tiers: tiers.data || [],
      sponsors: sponsors.data || [],
      invitations: invitations.data || [],
      agreements: agreements.data || [],
      recognition: recognition.data || null,
      items: items.data || [],
      statements: statements.data || [],
    });
  } catch (error) {
    console.error("Unable to load sponsors:", error);
    return json({ error: "Unable to load the sponsor workspace." }, 500);
  }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin)
      return json({ error: "Invalid request origin." }, 403);
    const parsed = input.safeParse(await request.json());
    if (!parsed.success) return json({ error: "Review the sponsor information and try again." }, 400);
    const value = parsed.data;
    const managed = await access(value.organizationId, value.auctionId);
    if (!managed) return json({ error: "Access denied." }, 403);
    const client = createSupabaseAdminClient();

    if (value.action === "save_tier") {
      const record = {
        organization_id: value.organizationId,
        auction_id: value.auctionId,
        name: value.name,
        display_rank: value.displayRank,
        display_style: value.displayStyle,
        is_visible: value.isVisible,
        updated_at: new Date().toISOString(),
      };
      const result = value.id
        ? await client.from("sponsorship_tiers").update(record).eq("id", value.id).eq("auction_id", value.auctionId)
        : await client.from("sponsorship_tiers").insert(record);
      if (result.error) throw result.error;
      return json({ ok: true });
    }

    if (value.action === "save_sponsor") {
      const website = value.websiteUrl ? safeSponsorWebsite(value.websiteUrl) : null;
      if (value.websiteUrl && !website)
        return json({ error: "Sponsor websites must use a valid HTTPS address." }, 400);
      const businessRecord = {
        organization_id: value.organizationId,
        business_name: value.businessName,
        logo_url: value.logoUrl || null,
        website_url: website,
        description: value.description,
        contact_name: value.contactName || null,
        contact_email: value.contactEmail || null,
        contact_phone: value.contactPhone || null,
        internal_notes: value.internalNotes,
        created_by: managed.user.userId,
        updated_at: new Date().toISOString(),
      };
      let businessId = value.sponsorBusinessId;
      if (businessId) {
        const { error } = await client
          .from("sponsor_businesses")
          .update(businessRecord)
          .eq("id", businessId)
          .eq("organization_id", value.organizationId);
        if (error) throw error;
      } else {
        const { data, error } = await client
          .from("sponsor_businesses")
          .insert(businessRecord)
          .select("id")
          .single();
        if (error) throw error;
        businessId = data.id;
      }
      const sponsorRecord = {
        organization_id: value.organizationId,
        auction_id: value.auctionId,
        sponsor_business_id: businessId,
        tier_id: value.tierId,
        commitment_cents: value.commitmentCents,
        public_recognition_enabled: value.publicRecognitionEnabled,
        display_order: value.displayOrder,
        status: value.status,
        created_by: managed.user.userId,
        updated_at: new Date().toISOString(),
      };
      const result = value.eventSponsorId
        ? await client.from("event_sponsors").update(sponsorRecord).eq("id", value.eventSponsorId).eq("auction_id", value.auctionId)
        : await client.from("event_sponsors").insert(sponsorRecord);
      if (result.error) throw result.error;
      return json({ ok: true });
    }

    if (value.action === "assign_item") {
      if (value.enabled) {
        const { error } = await client.from("auction_item_sponsors").upsert(
          { auction_item_id: value.auctionItemId, event_sponsor_id: value.eventSponsorId, recognition_enabled: true },
          { onConflict: "auction_item_id,event_sponsor_id" },
        );
        if (error) throw error;
      } else {
        const { error } = await client.from("auction_item_sponsors").delete().eq("auction_item_id", value.auctionItemId).eq("event_sponsor_id", value.eventSponsorId);
        if (error) throw error;
      }
      return json({ ok: true });
    }

    if (value.action === "invite_fee_sponsor") {
      const rawToken = randomPortalToken();
      const tokenHash = await hashPortalToken(rawToken);
      const { data: sponsor } = await client.from("event_sponsors").select("id").eq("id", value.eventSponsorId).eq("auction_id", value.auctionId).single();
      if (!sponsor) return json({ error: "Choose a sponsor for this event." }, 404);
      const { data, error } = await client
        .from("fee_sponsorship_invitations")
        .insert({
          organization_id: value.organizationId,
          auction_id: value.auctionId,
          event_sponsor_id: value.eventSponsorId,
          contact_name: value.contactName,
          contact_email: value.contactEmail.toLowerCase(),
          requested_coverage: value.requestedCoverage,
          proposed_maximum_cents: value.proposedMaximumCents,
          coverage_starts_at: value.coverageStartsAt || null,
          coverage_ends_at: value.coverageEndsAt || null,
          recognition_requested: value.recognitionRequested,
          invitation_message: value.invitationMessage,
          token_hash: tokenHash,
          expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
          created_by: managed.user.userId,
        })
        .select("id")
        .single();
      if (error) throw error;
      await invitationEmail(data.id, rawToken);
      return json({ ok: true, invitationId: data.id });
    }

    if (value.action === "resend_invitation") {
      const rawToken = randomPortalToken();
      const tokenHash = await hashPortalToken(rawToken);
      const { data, error } = await client
        .from("fee_sponsorship_invitations")
        .update({ token_hash: tokenHash, expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(), exchanged_at: null, status: "pending", revoked_at: null, updated_at: new Date().toISOString() })
        .eq("id", value.invitationId)
        .eq("auction_id", value.auctionId)
        .in("status", ["pending", "expired", "revoked"])
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Only an unaccepted invitation can be resent." }, 409);
      await invitationEmail(data.id, rawToken);
      return json({ ok: true });
    }

    if (value.action === "revoke_invitation") {
      const { error } = await client.from("fee_sponsorship_invitations").update({ status: "revoked", revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", value.invitationId).eq("auction_id", value.auctionId).in("status", ["pending", "counteroffered"]);
      if (error) throw error;
      await client.from("sponsor_portal_sessions").update({ revoked_at: new Date().toISOString() }).eq("invitation_id", value.invitationId);
      return json({ ok: true });
    }

    if (value.action === "approve_counteroffer") {
      const now = new Date().toISOString();
      const { data: invitation, error } = await client.from("fee_sponsorship_invitations").select("id").eq("id", value.invitationId).eq("auction_id", value.auctionId).eq("status", "counteroffered").maybeSingle();
      if (error) throw error;
      if (!invitation) return json({ error: "This counteroffer is no longer pending." }, 409);
      const { error: agreementError } = await client.from("fee_sponsorship_agreements").update({ status: "pending_payment_method", approved_by: managed.user.userId, approved_at: now, updated_at: now }).eq("invitation_id", invitation.id).eq("status", "pending_organizer_approval");
      if (agreementError) throw agreementError;
      await client.from("fee_sponsorship_invitations").update({ status: "accepted", updated_at: now }).eq("id", invitation.id);
      return json({ ok: true });
    }

    if (value.action === "save_recognition") {
      const { error } = await client.from("fee_sponsorship_recognition").upsert({
        auction_id: value.auctionId,
        organization_id: value.organizationId,
        donation_receipts: value.donationReceipts,
        winning_bid_confirmations: value.winningBidConfirmations,
        purchase_confirmations: value.purchaseConfirmations,
        ticket_confirmations: value.ticketConfirmations,
        show_sponsor_name: value.showSponsorName,
        show_sponsor_logo: value.showSponsorLogo,
        show_public_event_page: value.showPublicEventPage,
        updated_by: managed.user.userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "auction_id" });
      if (error) throw error;
      return json({ ok: true });
    }

    if (value.action === "create_statement") {
      if (managed.auction.ends > Date.now()) return json({ error: "Sponsor statements are created after the event closes." }, 409);
      const { data: agreement, error } = await client.from("fee_sponsorship_agreements").select("*").eq("id", value.agreementId).eq("auction_id", value.auctionId).in("status", ["active", "exhausted"]).single();
      if (error) throw error;
      const { data: invoices, error: invoiceError } = await client.from("winner_invoices").select("id,processing_fee_cents,winner_invoice_items(platform_fee_cents)").eq("auction_id", value.auctionId).in("status", ["paid", "partially_refunded", "refunded"]);
      if (invoiceError) throw invoiceError;
      for (const invoice of invoices || []) {
        const platform = (invoice.winner_invoice_items || []).reduce((sum, line) => sum + Number(line.platform_fee_cents || 0), 0);
        if (["platform", "both"].includes(agreement.coverage) && platform > 0)
          await client.rpc("allocate_sponsor_fee", { target_agreement_id: agreement.id, target_invoice_id: invoice.id, target_category: "platform", target_source_reference: `invoice:${invoice.id}:platform`, eligible_amount: platform });
        if (["processing", "both"].includes(agreement.coverage) && Number(invoice.processing_fee_cents || 0) > 0)
          await client.rpc("allocate_sponsor_fee", { target_agreement_id: agreement.id, target_invoice_id: invoice.id, target_category: "processing", target_source_reference: `invoice:${invoice.id}:processing`, eligible_amount: Number(invoice.processing_fee_cents) });
      }
      const { data: allocations, error: allocationError } = await client.from("fee_sponsorship_allocations").select("id,allocated_cents").eq("agreement_id", agreement.id).eq("status", "allocated");
      if (allocationError) throw allocationError;
      if (!allocations?.length) return json({ error: "No eligible unbilled fees are available." }, 409);
      const amount = allocations.reduce((sum, row) => sum + Number(row.allocated_cents), 0);
      const statementId = crypto.randomUUID();
      const { error: statementError } = await client.from("sponsor_billing_statements").insert({ id: statementId, agreement_id: agreement.id, organization_id: value.organizationId, auction_id: value.auctionId, statement_number: `GFS-${statementId.slice(0, 8).toUpperCase()}`, amount_cents: amount, status: "ready", issued_at: new Date().toISOString(), created_by: managed.user.userId });
      if (statementError) throw statementError;
      const { error: linkError } = await client.from("sponsor_statement_allocations").insert(allocations.map((row) => ({ statement_id: statementId, allocation_id: row.id })));
      if (linkError) throw linkError;
      await client.from("fee_sponsorship_allocations").update({ status: "invoiced", updated_at: new Date().toISOString() }).in("id", allocations.map((row) => row.id));
      return json({ ok: true, statementId });
    }

    if (value.action === "charge_statement") {
      const { data: statement, error } = await client.from("sponsor_billing_statements").select("*,fee_sponsorship_agreements(*)").eq("id", value.statementId).eq("auction_id", value.auctionId).eq("status", "ready").single();
      if (error) throw error;
      const agreement = Array.isArray(statement.fee_sponsorship_agreements) ? statement.fee_sponsorship_agreements[0] : statement.fee_sponsorship_agreements;
      if (!agreement?.stripe_customer_id || !agreement.stripe_payment_method_id) return json({ error: "The sponsor must authorize a payment method first." }, 409);
      const intent = await stripe().paymentIntents.create({
        amount: statement.amount_cents,
        currency: "usd",
        customer: agreement.stripe_customer_id,
        payment_method: agreement.stripe_payment_method_id,
        confirm: true,
        off_session: true,
        description: `Gather fee sponsorship ${statement.statement_number}`,
        metadata: { gather_sponsor_statement_id: statement.id, gather_sponsor_agreement_id: agreement.id, gather_auction_id: value.auctionId },
      }, { idempotencyKey: `gather-sponsor-statement-${statement.id}` });
      await client.from("sponsor_billing_statements").update({ status: intent.status === "succeeded" ? "paid" : "charging", stripe_payment_intent_id: intent.id, paid_at: intent.status === "succeeded" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", statement.id);
      return json({ ok: true, paymentStatus: intent.status });
    }

    return json({ error: "Unsupported sponsor action." }, 400);
  } catch (error) {
    console.error("Unable to update sponsors:", error);
    return json({ error: error instanceof Error && !/SQL|database|relation/i.test(error.message) ? error.message : "Unable to save sponsor changes." }, 500);
  }
}

import { cookies } from "next/headers";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { coverageLabel, hashPortalToken } from "@/lib/sponsors";
import { stripe } from "@/lib/stripe";
import { sendTemplateEmail } from "@/lib/email/resend";

export const dynamic = "force-dynamic";
const coverage = z.enum(["platform", "processing", "both"]);
const mutation = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("accept"),
    coverage,
    maximumCents: z.number().int().min(100).max(100_000_000),
    billingContactName: z.string().trim().min(2).max(120),
    billingContactEmail: z.string().email(),
    consent: z.literal(true),
  }),
  z.object({ action: z.literal("decline") }),
  z.object({ action: z.literal("start_setup") }),
  z.object({ action: z.literal("refresh_setup"), checkoutSessionId: z.string().min(5).max(200) }),
]);

async function portalSession() {
  const token = (await cookies()).get("gather_sponsor_portal")?.value;
  if (!token) return null;
  const client = createSupabaseAdminClient();
  const hash = await hashPortalToken(token);
  const { data, error } = await client
    .from("sponsor_portal_sessions")
    .select("id,invitation_id,expires_at,revoked_at")
    .eq("session_token_hash", hash)
    .maybeSingle();
  if (error || !data || data.revoked_at || new Date(data.expires_at).getTime() <= Date.now()) return null;
  await client.from("sponsor_portal_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", data.id);
  return data;
}

async function portalData(invitationId: string) {
  const client = createSupabaseAdminClient();
  const { data: invitation, error } = await client
    .from("fee_sponsorship_invitations")
    .select("*,organizations(display_name,accent_color),auctions(name,event_starts_at,closes_at),event_sponsors(id,sponsor_businesses(business_name,logo_url,website_url))")
    .eq("id", invitationId)
    .single();
  if (error) throw error;
  const { data: agreement, error: agreementError } = await client
    .from("fee_sponsorship_agreements")
    .select("id,coverage,maximum_cents,allocated_cents,charged_cents,refunded_cents,billing_schedule,billing_contact_name,billing_contact_email,status,stripe_payment_method_id,consented_at,activated_at,sponsor_billing_statements(id,statement_number,amount_cents,status,issued_at,paid_at)")
    .eq("invitation_id", invitationId)
    .maybeSingle();
  if (agreementError) throw agreementError;
  const organization = Array.isArray(invitation.organizations) ? invitation.organizations[0] : invitation.organizations;
  const auction = Array.isArray(invitation.auctions) ? invitation.auctions[0] : invitation.auctions;
  const eventSponsor = Array.isArray(invitation.event_sponsors) ? invitation.event_sponsors[0] : invitation.event_sponsors;
  const business = Array.isArray(eventSponsor?.sponsor_businesses) ? eventSponsor.sponsor_businesses[0] : eventSponsor?.sponsor_businesses;
  return {
    invitation: {
      id: invitation.id,
      status: invitation.status,
      contactName: invitation.contact_name,
      requestedCoverage: invitation.requested_coverage,
      proposedMaximumCents: invitation.proposed_maximum_cents,
      coverageStartsAt: invitation.coverage_starts_at,
      coverageEndsAt: invitation.coverage_ends_at,
      billingSchedule: invitation.billing_schedule,
      recognitionRequested: invitation.recognition_requested,
      invitationMessage: invitation.invitation_message,
      expiresAt: invitation.expires_at,
    },
    organization: {
      name: organization?.display_name || "Nonprofit",
      accentColor: organization?.accent_color || "#175b47",
    },
    auction: {
      name: auction?.name || "Fundraising event",
      eventStartsAt: auction?.event_starts_at,
      closesAt: auction?.closes_at,
    },
    sponsor: {
      name: business?.business_name || "Sponsor",
      logoUrl: business?.logo_url || null,
      websiteUrl: business?.website_url || null,
    },
    agreement: agreement
      ? {
          ...agreement,
          hasPaymentMethod: Boolean(agreement.stripe_payment_method_id),
          stripe_payment_method_id: undefined,
        }
      : null,
  };
}

export async function GET() {
  try {
    const session = await portalSession();
    if (!session) return Response.json({ error: "Sponsor access has expired." }, { status: 401 });
    return Response.json(await portalData(session.invitation_id), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Unable to load sponsor portal:", error);
    return Response.json({ error: "Unable to load the sponsor portal." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin)
      return Response.json({ error: "Invalid request origin." }, { status: 403 });
    const session = await portalSession();
    if (!session) return Response.json({ error: "Sponsor access has expired." }, { status: 401 });
    const parsed = mutation.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Review the sponsorship details and try again." }, { status: 400 });
    const value = parsed.data;
    const client = createSupabaseAdminClient();
    const data = await portalData(session.invitation_id);

    if (value.action === "decline") {
      if (!["pending", "counteroffered"].includes(data.invitation.status))
        return Response.json({ error: "This invitation can no longer be declined." }, { status: 409 });
      await client.from("fee_sponsorship_invitations").update({ status: "declined", updated_at: new Date().toISOString() }).eq("id", data.invitation.id);
      return Response.json({ ok: true });
    }

    if (value.action === "accept") {
      if (!["pending", "counteroffered"].includes(data.invitation.status))
        return Response.json({ error: "This invitation already has a response." }, { status: 409 });
      if (value.maximumCents > data.invitation.proposedMaximumCents)
        return Response.json({ error: "An increased commitment requires a new invitation from the nonprofit." }, { status: 400 });
      const changed = value.coverage !== data.invitation.requestedCoverage || value.maximumCents !== data.invitation.proposedMaximumCents;
      const now = new Date().toISOString();
      const record = {
        invitation_id: data.invitation.id,
        organization_id: (await client.from("fee_sponsorship_invitations").select("organization_id").eq("id", data.invitation.id).single()).data!.organization_id,
        auction_id: (await client.from("fee_sponsorship_invitations").select("auction_id").eq("id", data.invitation.id).single()).data!.auction_id,
        event_sponsor_id: (await client.from("fee_sponsorship_invitations").select("event_sponsor_id").eq("id", data.invitation.id).single()).data!.event_sponsor_id,
        coverage: value.coverage,
        maximum_cents: value.maximumCents,
        billing_contact_name: value.billingContactName,
        billing_contact_email: value.billingContactEmail.toLowerCase(),
        status: changed ? "pending_organizer_approval" : "pending_payment_method",
        consented_at: now,
        updated_at: now,
      };
      const { error } = await client.from("fee_sponsorship_agreements").upsert(record, { onConflict: "invitation_id" });
      if (error) throw error;
      await client.from("fee_sponsorship_invitations").update({ status: changed ? "counteroffered" : "accepted", updated_at: now }).eq("id", data.invitation.id);
      return Response.json({ ok: true, counteroffer: changed });
    }

    const { data: agreement, error: agreementError } = await client.from("fee_sponsorship_agreements").select("*").eq("invitation_id", data.invitation.id).single();
    if (agreementError) throw agreementError;

    if (value.action === "start_setup") {
      if (agreement.status !== "pending_payment_method")
        return Response.json({ error: agreement.status === "pending_organizer_approval" ? "The nonprofit must approve your counteroffer first." : "Payment authorization is not available for this agreement." }, { status: 409 });
      let customerId = agreement.stripe_customer_id as string | null;
      if (!customerId) {
        const customer = await stripe().customers.create({
          name: data.sponsor.name,
          email: agreement.billing_contact_email,
          metadata: { gather_sponsor_agreement_id: agreement.id, gather_auction_id: agreement.auction_id },
        }, { idempotencyKey: `gather-sponsor-customer-${agreement.id}` });
        customerId = customer.id;
      }
      const origin = new URL(request.url).origin;
      const checkout = await stripe().checkout.sessions.create({
        mode: "setup",
        customer: customerId,
        setup_intent_data: { metadata: { gather_sponsor_agreement_id: agreement.id, gather_auction_id: agreement.auction_id } },
        metadata: { gather_sponsor_agreement_id: agreement.id, gather_auction_id: agreement.auction_id },
        success_url: `${origin}/sponsor/portal?setup=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/sponsor/portal?setup=cancelled`,
        custom_text: { submit: { message: "Saving a payment method does not create an immediate charge. Future charges are limited by your approved sponsorship agreement." } },
      }, { idempotencyKey: `gather-sponsor-setup-${agreement.id}-${Math.floor(Date.now() / 3_600_000)}` });
      await client.from("fee_sponsorship_agreements").update({ stripe_customer_id: customerId, stripe_setup_session_id: checkout.id, updated_at: new Date().toISOString() }).eq("id", agreement.id);
      return Response.json({ url: checkout.url });
    }

    if (value.action === "refresh_setup") {
      if (agreement.stripe_setup_session_id !== value.checkoutSessionId)
        return Response.json({ error: "Payment authorization session mismatch." }, { status: 403 });
      const checkout = await stripe().checkout.sessions.retrieve(value.checkoutSessionId, { expand: ["setup_intent"] });
      const setupIntent = typeof checkout.setup_intent === "string" ? await stripe().setupIntents.retrieve(checkout.setup_intent) : checkout.setup_intent;
      const method = typeof setupIntent?.payment_method === "string" ? setupIntent.payment_method : setupIntent?.payment_method?.id;
      if (checkout.status !== "complete" || setupIntent?.status !== "succeeded" || !method)
        return Response.json({ error: "Stripe has not confirmed the payment method yet." }, { status: 409 });
      const now = new Date().toISOString();
      await client.from("fee_sponsorship_agreements").update({ stripe_payment_method_id: method, status: "active", activated_at: now, updated_at: now }).eq("id", agreement.id);
      await client.from("sponsor_payment_events").upsert({ agreement_id: agreement.id, event_type: "authorized", amount_cents: 0, stripe_reference: setupIntent.id, idempotency_key: `sponsor-authorized-${setupIntent.id}` }, { onConflict: "idempotency_key" });
      await sendTemplateEmail({
        to: agreement.billing_contact_email,
        templateId: "sponsor-authorization-confirmed",
        values: {
          sponsorBusinessName: data.sponsor.name,
          organizationName: data.organization.name,
          auctionName: data.auction.name,
          coverageLabel: coverageLabel(agreement.coverage),
          maximumCommitment: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(agreement.maximum_cents / 100),
          agreementStatus: "Active",
          portalUrl: `${new URL(request.url).origin}/sponsor/portal`,
        },
        idempotencyKey: `sponsor-authorization-${agreement.id}`,
      });
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Unsupported portal action." }, { status: 400 });
  } catch (error) {
    console.error("Unable to update sponsor portal:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save sponsorship changes." }, { status: 500 });
  }
}

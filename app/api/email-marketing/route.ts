import { z } from "zod";
import { managedOrganization } from "@/lib/organizer-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { aggregateCampaignMetrics, eligibleAudience, renderCampaignHtml, type AudienceRule, type CampaignBlock, type MarketingContact, type MarketingPreference } from "@/lib/email-marketing";
import { emailMarketingProviderReadiness, sendSesTestEmail } from "@/lib/email-marketing-providers";

export const dynamic = "force-dynamic";

const uuid = z.string().uuid();
const rule = z.object({ id: z.string().min(1).max(100), field: z.enum(["event_type","event_season","event_attendance","supporter_status","donation_history","tag","travel_interest","last_contribution","marketing_permission"]), operator: z.enum(["is","is_not","contains","greater_than","after"]), value: z.string().max(200) });
const block = z.object({ id: z.string().min(1).max(100), type: z.enum(["heading","text","image","button","divider","spacer"]), content: z.string().max(10_000).optional(), href: z.string().max(2_000).optional(), alt: z.string().max(500).optional() });
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("audience.preview"), organizationId: uuid, rules: z.array(rule).max(30), match: z.enum(["and","or"]).default("and") }),
  z.object({ action: z.literal("audience.save"), organizationId: uuid, id: uuid.optional(), name: z.string().trim().min(2).max(100), rules: z.array(rule).max(30), match: z.enum(["and","or"]).default("and") }),
  z.object({ action: z.literal("campaign.save"), organizationId: uuid, id: uuid.optional(), internalName: z.string().trim().min(2).max(140), subject: z.string().trim().max(240), previewText: z.string().trim().max(300), audienceId: uuid.nullable().optional(), sendingIdentityId: uuid.nullable().optional(), templateId: uuid.nullable().optional(), blocks: z.array(block).max(100) }),
  z.object({ action: z.literal("campaign.schedule"), organizationId: uuid, campaignId: uuid, scheduledFor: z.string().datetime() }),
  z.object({ action: z.literal("campaign.pause"), organizationId: uuid, campaignId: uuid }),
  z.object({ action: z.literal("campaign.test"), organizationId: uuid, campaignId: uuid, recipient: z.string().email() }),
  z.object({ action: z.literal("template.save"), organizationId: uuid, id: uuid.optional(), name: z.string().trim().min(2).max(120), category: z.string().trim().min(2).max(80), description: z.string().trim().max(500), blocks: z.array(block).max(100) }),
  z.object({ action: z.literal("automation.save"), organizationId: uuid, id: uuid.optional(), name: z.string().trim().min(2).max(120), workflowType: z.enum(["event_invitation","registration_reminder","auction_preview","auction_opening","event_reminder","post_event_followup","thank_you"]), audienceId: uuid.nullable().optional(), templateId: uuid.nullable().optional(), delayMinutes: z.number().int().min(0).max(525600), status: z.enum(["draft","active","paused"]).default("draft") }),
  z.object({ action: z.literal("identity.save"), organizationId: uuid, id: uuid.optional(), displayName: z.string().trim().min(2).max(120), fromEmail: z.string().email(), replyToEmail: z.string().email(), ownershipMode: z.enum(["existing","gather_managed"]), mailboxMode: z.enum(["mailbox","forwarding","mailbox_and_forwarding"]) }),
]);

function setupError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /relation .* does not exist|schema cache/i.test(message);
}

async function contactsAndPreferences(organizationId: string) {
  const client = createSupabaseAdminClient();
  const [{ data: contacts, error: contactError }, { data: preferences, error: preferenceError }] = await Promise.all([
    client.from("supporters").select("id,tags,last_activity_at,supporter_activities(activity_type,occurred_at,metadata)").eq("organization_id", organizationId),
    client.from("marketing_contact_preferences").select("supporter_id,marketing_status,validation_status,suppressed_at").eq("organization_id", organizationId),
  ]);
  if (contactError) throw contactError;
  if (preferenceError) throw preferenceError;
  return { contacts: (contacts || []) as MarketingContact[], preferences: (preferences || []) as MarketingPreference[] };
}

async function audienceCount(organizationId: string, rules: AudienceRule[], match: "and" | "or") {
  const { contacts, preferences } = await contactsAndPreferences(organizationId);
  return eligibleAudience(contacts, preferences, rules, match).length;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organization") || "";
  if (!uuid.safeParse(organizationId).success) return Response.json({ error: "Choose a nonprofit workspace." }, { status: 400 });
  const access = await managedOrganization(organizationId);
  if (!access) return Response.json({ error: "Access denied." }, { status: 403 });
  try {
    const client = createSupabaseAdminClient();
    const [campaignsResult, audiencesResult, templatesResult, identitiesResult, automationsResult, preferencesResult, supportersResult] = await Promise.all([
      client.from("email_campaigns").select("*,email_audiences(name),email_sending_identities(display_name,from_email,status)").eq("organization_id", organizationId).order("updated_at", { ascending: false }),
      client.from("email_audiences").select("*").eq("organization_id", organizationId).order("updated_at", { ascending: false }),
      client.from("email_templates").select("*").or(`organization_id.eq.${organizationId},is_system.eq.true`).order("is_system", { ascending: false }).order("name"),
      client.from("email_sending_identities").select("*").eq("organization_id", organizationId).order("updated_at", { ascending: false }),
      client.from("email_automations").select("*").eq("organization_id", organizationId).order("updated_at", { ascending: false }),
      client.from("marketing_contact_preferences").select("marketing_status,validation_status,suppressed_at").eq("organization_id", organizationId),
      client.from("supporters").select("id,tags").eq("organization_id", organizationId),
    ]);
    for (const result of [campaignsResult, audiencesResult, templatesResult, identitiesResult, automationsResult, preferencesResult, supportersResult]) if (result.error) throw result.error;
    const campaigns = campaignsResult.data || [];
    const preferences = preferencesResult.data || [];
    const totalContacts = (supportersResult.data || []).length;
    const contactsWithoutPreferences = Math.max(0, totalContacts - preferences.length);
    const listHealth = {
      total: totalContacts,
      deliverable: preferences.filter((item) => item.validation_status === "deliverable").length,
      risky: preferences.filter((item) => item.validation_status === "risky").length,
      unknown: contactsWithoutPreferences + preferences.filter((item) => ["unknown","not_checked"].includes(item.validation_status)).length,
      undeliverable: preferences.filter((item) => item.validation_status === "undeliverable").length,
      suppressed: preferences.filter((item) => Boolean(item.suppressed_at) || ["unsubscribed","complained"].includes(item.marketing_status)).length,
      eligible: preferences.filter((item) => item.marketing_status === "subscribed" && !item.suppressed_at && item.validation_status !== "undeliverable").length,
    };
    const tags = [...new Set((supportersResult.data || []).flatMap((item) => item.tags || []))].sort();
    const recommendations = campaigns.length
      ? ["Review recent click activity before choosing the next audience.", "Use a concise subject line that clearly names the fundraiser.", "Send a test to the approved test inbox before scheduling."]
      : ["Create a permission-based audience before designing the first campaign.", "Verify a sending identity before scheduling delivery.", "Start with a save-the-date or auction-preview template."];
    return Response.json({ organization: { id: access.nonprofit.id, name: access.nonprofit.name }, campaigns, audiences: audiencesResult.data || [], templates: templatesResult.data || [], identities: identitiesResult.data || [], automations: automationsResult.data || [], metrics: aggregateCampaignMetrics(campaigns), listHealth, tags, providers: emailMarketingProviderReadiness(), recommendations }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Unable to load email marketing:", error);
    if (setupError(error)) return Response.json({ error: "Email Marketing database setup is required.", setupRequired: true }, { status: 503 });
    return Response.json({ error: "Unable to load Email Marketing." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Invalid request origin." }, { status: 403 });
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Check the email marketing information and try again.", issues: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })) }, { status: 400 });
    const input = parsed.data;
    const access = await managedOrganization(input.organizationId);
    if (!access) return Response.json({ error: "Access denied." }, { status: 403 });
    const client = createSupabaseAdminClient();
    const now = new Date().toISOString();

    if (input.action === "audience.preview" || input.action === "audience.save") {
      const count = await audienceCount(input.organizationId, input.rules, input.match);
      if (input.action === "audience.preview") return Response.json({ eligibleCount: count });
      const id = input.id || crypto.randomUUID();
      const { data, error } = await client.from("email_audiences").upsert({ id, organization_id: input.organizationId, name: input.name, rules: input.rules, rule_match: input.match, last_eligible_count: count, last_calculated_at: now, created_by: access.user.userId }, { onConflict: "id" }).select("*").single();
      if (error) throw error;
      return Response.json({ audience: data });
    }

    if (input.action === "campaign.save") {
      const id = input.id || crypto.randomUUID();
      const html = renderCampaignHtml(input.blocks as CampaignBlock[], `${new URL(request.url).origin}/api/email-marketing/unsubscribe?campaign=${id}&token={{unsubscribe_token}}`);
      const { data: previous } = await client.from("email_campaigns").select("*").eq("id", id).eq("organization_id", input.organizationId).maybeSingle();
      const { data, error } = await client.from("email_campaigns").upsert({ id, organization_id: input.organizationId, audience_id: input.audienceId || null, sending_identity_id: input.sendingIdentityId || null, template_id: input.templateId || null, internal_name: input.internalName, subject: input.subject, preview_text: input.previewText, blocks: input.blocks, rendered_html: html, status: previous?.status || "draft", created_by: access.user.userId }, { onConflict: "id" }).select("*").single();
      if (error) throw error;
      await client.from("email_campaign_audit_events").insert({ organization_id: input.organizationId, campaign_id: id, actor_id: access.user.userId, action: previous ? "campaign.updated" : "campaign.created", previous_state: previous, new_state: data });
      return Response.json({ campaign: data });
    }

    if (input.action === "campaign.schedule") {
      const { data: campaign, error } = await client.from("email_campaigns").select("*,email_audiences(*),email_sending_identities(*)").eq("id", input.campaignId).eq("organization_id", input.organizationId).single();
      if (error) throw error;
      const blockers: string[] = [];
      if (!campaign.subject || !(campaign.blocks || []).length) blockers.push("Add a subject and email content.");
      if (!campaign.email_audiences) blockers.push("Choose an audience.");
      if (!campaign.email_sending_identities || campaign.email_sending_identities.status !== "verified") blockers.push("Choose a verified sending identity.");
      if (!emailMarketingProviderReadiness().ses.configured) blockers.push("Configure Amazon SES for marketing delivery.");
      if (!process.env.EMAIL_MARKETING_QUEUE_URL) blockers.push("Configure the campaign queue worker.");
      if (blockers.length) return Response.json({ error: "This campaign is not ready to schedule.", blockers }, { status: 409 });
      const count = await audienceCount(input.organizationId, campaign.email_audiences.rules || [], campaign.email_audiences.rule_match || "and");
      if (!count) return Response.json({ error: "The selected audience has no eligible recipients." }, { status: 409 });
      const { data, error: updateError } = await client.from("email_campaigns").update({ status: "scheduled", scheduled_for: input.scheduledFor, intended_count: count }).eq("id", input.campaignId).eq("organization_id", input.organizationId).select("*").single();
      if (updateError) throw updateError;
      return Response.json({ campaign: data });
    }

    if (input.action === "campaign.pause") {
      const { data, error } = await client.from("email_campaigns").update({ status: "paused" }).eq("id", input.campaignId).eq("organization_id", input.organizationId).in("status", ["scheduled","sending"]).select("*").single();
      if (error) throw error;
      return Response.json({ campaign: data });
    }

    if (input.action === "campaign.test") {
      const { data: campaign, error } = await client.from("email_campaigns").select("*,email_sending_identities(*)").eq("id", input.campaignId).eq("organization_id", input.organizationId).single();
      if (error) throw error;
      const identity = campaign.email_sending_identities;
      if (!identity || identity.status !== "verified") return Response.json({ error: "A verified sending identity is required." }, { status: 409 });
      const result = await sendSesTestEmail({ to: input.recipient, from: identity.from_email, replyTo: identity.reply_to_email, subject: `[TEST] ${campaign.subject || campaign.internal_name}`, html: campaign.rendered_html });
      return Response.json({ sent: true, messageId: result.messageId });
    }

    if (input.action === "template.save") {
      const id = input.id || crypto.randomUUID();
      const { data, error } = await client.from("email_templates").upsert({ id, organization_id: input.organizationId, name: input.name, category: input.category, description: input.description, blocks: input.blocks, is_system: false, created_by: access.user.userId }, { onConflict: "id" }).select("*").single();
      if (error) throw error;
      return Response.json({ template: data });
    }

    if (input.action === "automation.save") {
      const id = input.id || crypto.randomUUID();
      const requestedStatus = input.status === "active" && !process.env.EMAIL_MARKETING_QUEUE_URL ? "draft" : input.status;
      const { data, error } = await client.from("email_automations").upsert({ id, organization_id: input.organizationId, name: input.name, workflow_type: input.workflowType, audience_id: input.audienceId || null, template_id: input.templateId || null, delay_minutes: input.delayMinutes, status: requestedStatus, trigger_config: {}, created_by: access.user.userId }, { onConflict: "id" }).select("*").single();
      if (error) throw error;
      return Response.json({ automation: data, warning: requestedStatus !== input.status ? "Automation saved as a draft until the campaign queue worker is configured." : null });
    }

    const id = input.id || crypto.randomUUID();
    const domain = input.fromEmail.split("@")[1].toLowerCase();
    const { data, error } = await client.from("email_sending_identities").upsert({ id, organization_id: input.organizationId, display_name: input.displayName, from_email: input.fromEmail.toLowerCase(), reply_to_email: input.replyToEmail.toLowerCase(), domain_name: domain, ownership_mode: input.ownershipMode, mailbox_mode: input.mailboxMode, status: input.ownershipMode === "existing" ? "dns_required" : "pending", created_by: access.user.userId }, { onConflict: "id" }).select("*").single();
    if (error) throw error;
    return Response.json({ identity: data, notice: input.ownershipMode === "gather_managed" ? "Domain registration has not been submitted. OpenSRS configuration and explicit purchase approval are required." : "Add the displayed authentication records after SES returns them; Gather will not modify DNS without authorization." });
  } catch (error) {
    console.error("Unable to update email marketing:", error);
    if (setupError(error)) return Response.json({ error: "Email Marketing database setup is required.", setupRequired: true }, { status: 503 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update Email Marketing." }, { status: 500 });
  }
}

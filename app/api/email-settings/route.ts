import { z } from "zod";
import { getAppUser } from "@/lib/auth";
import { sendTemplateEmail } from "@/lib/email/resend";
import { database } from "@/lib/nonprofits";
import { managedAuction, managedOrganization } from "@/lib/organizer-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const settings = z.object({
  organizationId: z.string().uuid(),
  auctionId: z.string().uuid().nullable().optional(),
  inheritsDefaults: z.boolean().default(true),
  showLogo: z.boolean().default(true),
  logoAlignment: z.enum(["left", "center"]).default("left"),
  thankYouHeading: z.string().trim().min(1).max(120),
  thankYouMessage: z.string().trim().min(1).max(600),
  receiptFooter: z.string().trim().min(1).max(400),
  replyToEmail: z.string().email().or(z.literal("")).optional(),
  action: z.enum(["save", "test"]).default("save"),
});

async function digest(value: string) {
  return Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  ).toString("hex");
}
const baseUrl = () =>
  (process.env.APP_URL || "https://gatherforgood.bid").replace(/\/$/, "");

export async function GET(request: Request) {
  const user = await getAppUser();
  if (!user)
    return Response.json({ error: "Sign in to continue." }, { status: 401 });
  const organizationId =
    new URL(request.url).searchParams.get("organization") || "";
  const access = await managedOrganization(organizationId);
  if (!access)
    return Response.json({ error: "Access denied." }, { status: 403 });
  const client = createSupabaseAdminClient();
  const [
    { data: organization },
    { data: settings },
    { data: overrides },
    auctionRows,
  ] = await Promise.all([
    client
      .from("organizations")
      .select("id,display_name,logo_url,accent_color")
      .eq("id", organizationId)
      .maybeSingle(),
    client
      .from("organization_email_settings")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    client
      .from("auction_email_overrides")
      .select("*")
      .eq("organization_id", organizationId),
    database()
      .prepare(
        "SELECT id,state FROM auctions WHERE nonprofit_id=? ORDER BY created DESC",
      )
      .bind(organizationId)
      .all<{ id: string; state: string }>(),
  ]);
  const auctions = auctionRows.results.map((row) => {
    const state = JSON.parse(row.state) as { name?: string };
    return { id: row.id, name: state.name || "Auction" };
  });
  return Response.json(
    {
      organization,
      settings,
      overrides: overrides || [],
      auctions,
      currentUserEmail: user.email,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return Response.json({ error: "Invalid origin." }, { status: 403 });
  const user = await getAppUser();
  if (!user)
    return Response.json({ error: "Sign in to continue." }, { status: 401 });
  const parsed = settings.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: "Check the email settings and try again." },
      { status: 400 },
    );
  const input = parsed.data,
    access = input.auctionId
      ? await managedAuction(input.auctionId)
      : await managedOrganization(input.organizationId);
  if (!access || access.nonprofit?.id !== input.organizationId)
    return Response.json({ error: "Access denied." }, { status: 403 });
  const client = createSupabaseAdminClient(),
    now = new Date().toISOString();
  if (input.action === "test") {
    await sendTemplateEmail({
      to: user.email,
      templateId: "receipt-settings-test",
      values: {
        organizationName: access.nonprofit.name,
        thankYouHeading: input.thankYouHeading,
        thankYouMessage: input.thankYouMessage,
        receiptFooter: input.receiptFooter,
        settingsUrl: `${baseUrl()}/admin/settings/email-receipts?organization=${input.organizationId}`,
      },
      idempotencyKey: `receipt-preview-${user.userId}-${Date.now()}`,
    });
    return Response.json({ ok: true, recipient: user.email });
  }
  if (input.auctionId) {
    const { error } = await client.from("auction_email_overrides").upsert(
      {
        auction_id: input.auctionId,
        organization_id: input.organizationId,
        inherits_defaults: input.inheritsDefaults,
        thank_you_heading: input.inheritsDefaults
          ? null
          : input.thankYouHeading,
        thank_you_message: input.inheritsDefaults
          ? null
          : input.thankYouMessage,
        receipt_footer: input.inheritsDefaults ? null : input.receiptFooter,
        updated_by: user.userId,
        updated_at: now,
      },
      { onConflict: "auction_id" },
    );
    if (error)
      return Response.json(
        { error: "Unable to save auction email settings." },
        { status: 500 },
      );
    return Response.json({ ok: true });
  }
  const existing = await client
    .from("organization_email_settings")
    .select("reply_to_email,pending_reply_to_email")
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  const requested = input.replyToEmail?.trim().toLowerCase() || "";
  const current = existing.data?.reply_to_email?.toLowerCase() || "";
  const requestVerification = Boolean(requested && requested !== current);
  const token = requestVerification
    ? crypto.randomUUID() + crypto.randomUUID()
    : "";
  const { error } = await client.from("organization_email_settings").upsert(
    {
      organization_id: input.organizationId,
      show_logo: input.showLogo,
      logo_alignment: input.logoAlignment,
      thank_you_heading: input.thankYouHeading,
      thank_you_message: input.thankYouMessage,
      receipt_footer: input.receiptFooter,
      ...(requestVerification
        ? {
            pending_reply_to_email: requested,
            reply_to_verification_hash: await digest(token),
            reply_to_verification_expires_at: new Date(
              Date.now() + 24 * 60 * 60 * 1000,
            ).toISOString(),
          }
        : {}),
      updated_by: user.userId,
      updated_at: now,
    },
    { onConflict: "organization_id" },
  );
  if (error)
    return Response.json(
      { error: "Unable to save organization email settings." },
      { status: 500 },
    );
  if (requestVerification) {
    await sendTemplateEmail({
      to: requested,
      templateId: "reply-to-verification",
      values: {
        replyToEmail: requested,
        organizationName: access.nonprofit.name,
        verificationUrl: `${baseUrl()}/api/email-settings/verify?organization=${input.organizationId}&token=${encodeURIComponent(token)}`,
      },
      idempotencyKey: `reply-to-${input.organizationId}-${await digest(requested)}`,
    });
  }
  return Response.json({ ok: true, verificationSent: requestVerification });
}

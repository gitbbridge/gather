import { z } from "zod";
import { getAppUser } from "@/lib/auth";
import { sendTrackedTemplateEmail } from "@/lib/email/notifications";
import { cleanMessage, announcementAudiences } from "@/lib/message-rules";
import { managedAuction } from "@/lib/organizer-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  auctionId: z.string().uuid(),
  title: z.string().min(1).max(160),
  body: z.string().min(1).max(4000),
  audience: z.enum(announcementAudiences),
  idempotencyKey: z.string().min(8).max(120),
});
export async function POST(request: Request) {
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return Response.json({ error: "Invalid origin." }, { status: 403 });
  const user = await getAppUser();
  if (!user)
    return Response.json({ error: "Sign in to continue." }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: "Check the announcement and try again." },
      { status: 400 },
    );
  const input = parsed.data,
    access = await managedAuction(input.auctionId);
  if (!access?.nonprofit)
    return Response.json(
      { error: "Organizer access required." },
      { status: 403 },
    );
  const client = createSupabaseAdminClient();
  const created = await client
    .from("announcements")
    .insert({
      organization_id: access.nonprofit.id,
      auction_id: input.auctionId,
      created_by: user.userId,
      title: cleanMessage(input.title, 160),
      body: cleanMessage(input.body),
      audience: input.audience,
      status: "sending",
      idempotency_key: input.idempotencyKey,
    })
    .select("*")
    .single();
  if (created.error) {
    if (created.error.code === "23505")
      return Response.json({ ok: true, duplicate: true });
    return Response.json(
      { error: "Unable to save the announcement." },
      { status: 500 },
    );
  }
  let query;
  if (input.audience === "all_registered")
    query = client
      .from("bidder_registrations")
      .select("bidder_id")
      .eq("auction_id", input.auctionId);
  else if (input.audience === "active_bidders")
    query = client
      .from("bids")
      .select("bidder_id")
      .eq("auction_id", input.auctionId);
  else
    query = client
      .from("winner_invoices")
      .select("payer_id")
      .eq("auction_id", input.auctionId)
      .in(
        "status",
        input.audience === "unpaid_winners"
          ? ["open", "payment_pending", "past_due"]
          : [
              "open",
              "payment_pending",
              "past_due",
              "paid",
              "partially_refunded",
              "refunded",
            ],
      );
  const { data, error } = await query;
  if (error) {
    await client
      .from("announcements")
      .update({ status: "failed" })
      .eq("id", created.data.id);
    return Response.json(
      { error: "Unable to determine the selected audience." },
      { status: 500 },
    );
  }
  const userIds = [
    ...new Set(
      (data || [])
        .map((row: Record<string, string>) => row.bidder_id || row.payer_id)
        .filter(Boolean),
    ),
  ];
  await client
    .from("announcement_recipients")
    .insert(
      userIds.map((userId) => ({
        announcement_id: created.data.id,
        user_id: userId,
      })),
    );
  let sent = 0,
    failed = 0;
  for (const userId of userIds) {
    try {
      const { data: profile } = await client.auth.admin.getUserById(userId);
      if (!profile.user?.email) throw Error("No email");
      const result = await sendTrackedTemplateEmail({
        userId,
        recipientEmail: profile.user.email,
        auctionId: input.auctionId,
        templateId: "event-announcement",
        dedupeKey: `announcement-${created.data.id}-${userId}`,
        values: {
          announcementTitle: input.title,
          announcementBody: input.body,
          auctionName: access.auction.name,
          organizationName: access.nonprofit.name,
          auctionUrl: `${(process.env.APP_URL || "https://gatherforgood.bid").replace(/\/$/, "")}/?auction=${input.auctionId}`,
        },
      });
      await client
        .from("announcement_recipients")
        .update({
          delivery_status: "sent",
          provider_reference: result.id,
          sent_at: new Date().toISOString(),
        })
        .eq("announcement_id", created.data.id)
        .eq("user_id", userId);
      sent++;
    } catch {
      await client
        .from("announcement_recipients")
        .update({ delivery_status: "failed" })
        .eq("announcement_id", created.data.id)
        .eq("user_id", userId);
      failed++;
    }
  }
  await client
    .from("announcements")
    .update({
      status: failed && sent === 0 ? "failed" : "sent",
      recipient_count: userIds.length,
      sent_at: new Date().toISOString(),
    })
    .eq("id", created.data.id);
  return Response.json({ ok: true, recipients: userIds.length, sent, failed });
}

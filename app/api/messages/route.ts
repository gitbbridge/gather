import { z } from "zod";
import { getAppUser } from "@/lib/auth";
import { database } from "@/lib/nonprofits";
import { managedOrganization } from "@/lib/organizer-access";
import {
  cleanMessage,
  conversationKey,
  conversationStatuses,
} from "@/lib/message-rules";
import { safelySendTrackedTemplateEmail } from "@/lib/email/notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    auctionId: z.string().uuid(),
    itemId: z.string().uuid().nullable().optional(),
    subject: z.string().min(1).max(160),
    body: z.string().min(1).max(4000),
    clientRequestId: z.string().max(100).optional(),
  }),
  z.object({
    action: z.literal("send"),
    conversationId: z.string().uuid(),
    body: z.string().min(1).max(4000),
    clientRequestId: z.string().max(100).optional(),
    messageType: z
      .enum(["user", "payment_reminder", "fulfillment"])
      .default("user"),
  }),
  z.object({
    action: z.literal("status"),
    conversationId: z.string().uuid(),
    status: z.enum(conversationStatuses),
  }),
  z.object({ action: z.literal("read"), conversationId: z.string().uuid() }),
  z.object({
    action: z.literal("report"),
    messageId: z.string().uuid(),
    reason: z.enum(["spam", "harassment", "fraud", "other"]),
    details: z.string().max(1000).optional(),
  }),
]);

const originOkay = (request: Request) =>
  !request.headers.get("origin") ||
  request.headers.get("origin") === new URL(request.url).origin;

async function conversationAccess(conversationId: string, userId: string) {
  const client = createSupabaseAdminClient();
  const { data: conversation } = await client
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conversation) return null;
  const { data: participant } = await client
    .from("conversation_participants")
    .select("role")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (participant)
    return {
      conversation,
      role: participant.role as "bidder" | "organizer" | "support",
    };
  const access = await managedOrganization(conversation.organization_id);
  return access ? { conversation, role: "organizer" as const } : null;
}

async function notifyOtherParticipants(input: {
  conversationId: string;
  senderId: string;
  senderName: string;
  subject: string;
  body: string;
}) {
  const client = createSupabaseAdminClient();
  const { data: participants } = await client
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", input.conversationId)
    .neq("user_id", input.senderId);
  await Promise.all(
    (participants || []).map(async (participant) => {
      const { data } = await client.auth.admin.getUserById(participant.user_id);
      if (!data.user?.email) return;
      await safelySendTrackedTemplateEmail({
        userId: participant.user_id,
        recipientEmail: data.user.email,
        templateId: "private-message",
        dedupeKey: `message-${input.conversationId}-${crypto.randomUUID()}`,
        values: {
          senderName: input.senderName,
          conversationSubject: input.subject,
          messagePreview: input.body.slice(0, 240),
          conversationUrl: `${(process.env.APP_URL || "https://gatherforgood.bid").replace(/\/$/, "")}/messages?conversation=${input.conversationId}`,
        },
      });
    }),
  );
}

export async function GET(request: Request) {
  const user = await getAppUser();
  if (!user)
    return Response.json(
      { error: "Sign in to view messages." },
      { status: 401 },
    );
  const organizationId = new URL(request.url).searchParams.get("organization");
  const client = createSupabaseAdminClient();
  let ids: string[] = [];
  if (organizationId) {
    if (!(await managedOrganization(organizationId)))
      return Response.json({ error: "Access denied." }, { status: 403 });
    const { data } = await client
      .from("conversations")
      .select("id")
      .eq("organization_id", organizationId)
      .order("last_message_at", { ascending: false });
    ids = (data || []).map((row) => row.id);
  } else {
    const { data } = await client
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.userId);
    ids = (data || []).map((row) => row.conversation_id);
  }
  if (!ids.length)
    return Response.json(
      { conversations: [] },
      { headers: { "cache-control": "no-store" } },
    );
  const { data, error } = await client
    .from("conversations")
    .select("*,messages(*),conversation_participants(*)")
    .in("id", ids)
    .order("last_message_at", { ascending: false })
    .order("created_at", { referencedTable: "messages", ascending: true });
  if (error) throw error;
  const userIds = [
    ...new Set(
      (data || []).flatMap((row) =>
        row.conversation_participants.map(
          (p: { user_id: string }) => p.user_id,
        ),
      ),
    ),
  ];
  const profiles = Object.fromEntries(
    (
      await Promise.all(
        userIds.map(async (id) => {
          const { data: profile } = await client.auth.admin.getUserById(id);
          return [
            id,
            {
              email: profile.user?.email || "",
              name:
                profile.user?.user_metadata?.full_name ||
                profile.user?.email ||
                "Gather user",
            },
          ];
        }),
      )
    ).map((value) => value as [string, { email: string; name: string }]),
  );
  return Response.json(
    { conversations: data, profiles, currentUserId: user.userId },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (!originOkay(request))
    return Response.json({ error: "Invalid origin." }, { status: 403 });
  const user = await getAppUser();
  if (!user)
    return Response.json({ error: "Sign in to continue." }, { status: 401 });
  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: "Check the message details and try again." },
      { status: 400 },
    );
  const input = parsed.data,
    client = createSupabaseAdminClient(),
    now = new Date().toISOString();
  if (input.action === "create") {
    const row = await database()
      .prepare("SELECT id,owner,nonprofit_id,state FROM auctions WHERE id=?")
      .bind(input.auctionId)
      .first<{
        id: string;
        owner: string;
        nonprofit_id: string | null;
        state: string;
      }>();
    if (!row?.nonprofit_id)
      return Response.json(
        { error: "This auction is not available for messages." },
        { status: 404 },
      );
    const state = JSON.parse(row.state) as {
      name?: string;
      items?: { id: string; title: string }[];
    };
    const item = input.itemId
      ? state.items?.find((entry) => entry.id === input.itemId)
      : null;
    if (input.itemId && !item)
      return Response.json(
        { error: "Auction item not found." },
        { status: 404 },
      );
    const key = conversationKey({
      bidderId: user.userId,
      auctionId: input.auctionId,
      itemId: input.itemId,
    });
    let { data: conversation } = await client
      .from("conversations")
      .select("*")
      .eq("organization_id", row.nonprofit_id)
      .eq("participant_key", key)
      .maybeSingle();
    if (!conversation) {
      const created = await client
        .from("conversations")
        .insert({
          organization_id: row.nonprofit_id,
          auction_id: input.auctionId,
          auction_item_id: input.itemId || null,
          subject: cleanMessage(input.subject, 160),
          created_by: user.userId,
          participant_key: key,
        })
        .select("*")
        .single();
      if (created.error)
        return Response.json(
          { error: "Unable to start this conversation." },
          { status: 500 },
        );
      conversation = created.data;
      await client.from("conversation_participants").upsert(
        [
          {
            conversation_id: conversation.id,
            user_id: user.userId,
            role: "bidder",
          },
          {
            conversation_id: conversation.id,
            user_id: row.owner,
            role: "organizer",
          },
        ],
        { onConflict: "conversation_id,user_id" },
      );
    }
    const recent = await client
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", user.userId)
      .gte("created_at", new Date(Date.now() - 60_000).toISOString());
    if ((recent.count || 0) >= 10)
      return Response.json(
        { error: "Please wait a moment before sending another message." },
        { status: 429 },
      );
    const inserted = await client
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        sender_id: user.userId,
        sender_role: "bidder",
        body: cleanMessage(input.body),
        client_request_id: input.clientRequestId || crypto.randomUUID(),
      })
      .select("*")
      .single();
    if (inserted.error)
      return Response.json(
        { error: "Unable to save your message." },
        { status: 500 },
      );
    await client
      .from("conversations")
      .update({ last_message_at: now, updated_at: now, status: "open" })
      .eq("id", conversation.id);
    void notifyOtherParticipants({
      conversationId: conversation.id,
      senderId: user.userId,
      senderName: user.displayName,
      subject: item?.title || conversation.subject,
      body: inserted.data.body,
    });
    return Response.json({
      conversationId: conversation.id,
      message: inserted.data,
    });
  }
  if (input.action === "report") {
    const { data: message } = await client
      .from("messages")
      .select("conversation_id")
      .eq("id", input.messageId)
      .maybeSingle();
    if (
      !message ||
      !(await conversationAccess(message.conversation_id, user.userId))
    )
      return Response.json({ error: "Message not found." }, { status: 404 });
    const { error } = await client
      .from("message_reports")
      .upsert(
        {
          message_id: input.messageId,
          reporter_id: user.userId,
          reason: input.reason,
          details: cleanMessage(input.details, 1000) || null,
        },
        { onConflict: "message_id,reporter_id" },
      );
    return error
      ? Response.json({ error: "Unable to submit report." }, { status: 500 })
      : Response.json({ ok: true });
  }
  const access = await conversationAccess(input.conversationId, user.userId);
  if (!access)
    return Response.json(
      { error: "Conversation not found or access denied." },
      { status: 404 },
    );
  if (input.action === "read") {
    await client
      .from("conversation_participants")
      .update({ last_read_at: now })
      .eq("conversation_id", input.conversationId)
      .eq("user_id", user.userId);
    return Response.json({ ok: true });
  }
  if (input.action === "status") {
    if (access.role !== "organizer")
      return Response.json(
        { error: "Only organizers can change conversation status." },
        { status: 403 },
      );
    await client
      .from("conversations")
      .update({ status: input.status, updated_at: now })
      .eq("id", input.conversationId);
    return Response.json({ ok: true });
  }
  const recent = await client
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", user.userId)
    .gte("created_at", new Date(Date.now() - 60_000).toISOString());
  if ((recent.count || 0) >= 10)
    return Response.json(
      { error: "Please wait a moment before sending another message." },
      { status: 429 },
    );
  if (input.messageType === "payment_reminder" && access.role !== "organizer")
    return Response.json(
      { error: "Only organizers can send payment reminders." },
      { status: 403 },
    );
  const inserted = await client
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
      sender_id: user.userId,
      sender_role: access.role,
      body: cleanMessage(input.body),
      message_type: input.messageType,
      client_request_id: input.clientRequestId || crypto.randomUUID(),
    })
    .select("*")
    .single();
  if (inserted.error)
    return Response.json(
      { error: "Unable to save your message." },
      { status: 500 },
    );
  await client
    .from("conversations")
    .update({
      last_message_at: now,
      updated_at: now,
      status: access.role === "organizer" ? "pending" : "open",
    })
    .eq("id", input.conversationId);
  void notifyOtherParticipants({
    conversationId: input.conversationId,
    senderId: user.userId,
    senderName: user.displayName,
    subject: access.conversation.subject,
    body: inserted.data.body,
  });
  return Response.json({ message: inserted.data });
}

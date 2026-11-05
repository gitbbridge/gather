"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Flag, Inbox, LoaderCircle, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast, Toaster } from "sonner";
import Link from "next/link";

type Message = {
  id: string;
  sender_id: string;
  body: string;
  message_type: string;
  created_at: string;
};
type Participant = {
  user_id: string;
  role: string;
  last_read_at: string | null;
};
type Conversation = {
  id: string;
  subject: string;
  status: "open" | "pending" | "resolved";
  last_message_at: string;
  messages: Message[];
  conversation_participants: Participant[];
};
type Payload = {
  conversations: Conversation[];
  profiles: Record<string, { name: string; email: string }>;
  currentUserId: string;
  error?: string;
};

export default function MessagesClient({
  params,
}: {
  params: Record<string, string | undefined>;
}) {
  const organization = params.organization || "",
    [data, setData] = useState<Payload | null>(null),
    [selected, setSelected] = useState(params.conversation || ""),
    [body, setBody] = useState(""),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [compose, setCompose] = useState(Boolean(params.auction) && !organization),
    [composeAnnouncement, setComposeAnnouncement] = useState(false),
    [announcementTitle, setAnnouncementTitle] = useState(""),
    [announcementAudience, setAnnouncementAudience] =
      useState("all_registered");
  const load = useCallback(async () => {
    const response = await fetch(
      `/api/messages${organization ? `?organization=${encodeURIComponent(organization)}` : ""}`,
    );
    const value = (await response.json()) as Payload;
    if (!response.ok) throw Error(value.error || "Unable to load messages.");
    setData(value);
    if (!selected && value.conversations[0])
      setSelected(value.conversations[0].id);
  }, [organization, selected]);
  useEffect(() => {
    // Loading remote state is the purpose of this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((error) => toast.error(error.message));
  }, [load]);
  const conversations = useMemo(
    () =>
      (data?.conversations || []).filter(
        (item) =>
          item.subject.toLowerCase().includes(search.toLowerCase()) ||
          item.messages.some((message) =>
            message.body.toLowerCase().includes(search.toLowerCase()),
          ),
      ),
    [data, search],
  );
  const active = data?.conversations.find((item) => item.id === selected);
  const organizer =
    Boolean(
      active?.conversation_participants.find(
        (p) => p.user_id === data?.currentUserId && p.role === "organizer",
      ),
    ) || Boolean(organization);
  const post = async (payload: unknown) => {
    setBusy(true);
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const value = (await response.json()) as {
        error?: string;
        conversationId?: string;
      };
      if (!response.ok) throw Error(value.error || "Unable to send message.");
      if (value.conversationId) setSelected(value.conversationId);
      setBody("");
      setCompose(false);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to send message.",
      );
    } finally {
      setBusy(false);
    }
  };
  const unread = (conversation: Conversation) => {
    const participant = conversation.conversation_participants.find(
      (p) => p.user_id === data?.currentUserId,
    );
    return conversation.messages.some(
      (message) =>
        message.sender_id !== data?.currentUserId &&
        (!participant?.last_read_at ||
          new Date(message.created_at) > new Date(participant.last_read_at)),
    );
  };
  const sendAnnouncement = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/messages/announcements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          auctionId: params.auction,
          title: announcementTitle,
          body,
          audience: announcementAudience,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const value = (await response.json()) as {
        error?: string;
        sent?: number;
      };
      if (!response.ok)
        throw Error(value.error || "Unable to send announcement.");
      toast.success(
        `Announcement sent to ${value.sent || 0} participant${value.sent === 1 ? "" : "s"}.`,
      );
      setAnnouncementTitle("");
      setBody("");
      setComposeAnnouncement(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to send announcement.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="min-h-screen bg-[#f4f7f5]">
      <Toaster richColors />
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <a
            href={organization ? `/admin?auction=${params.auction || ""}` : "/"}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <ArrowLeft size={16} />
            Back
          </a>
          <Link href="/" className="text-2xl font-semibold text-[#175b47]">
            gather<span className="text-[#78a68b]">.</span>
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-muted-foreground">
              AUCTION COMMUNICATION
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Messages</h1>
            <p className="mt-2 text-muted-foreground">
              Private questions, replies, and important auction updates.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {organization && params.auction && (
              <Button
                variant="outline"
                onClick={() => setComposeAnnouncement(true)}
              >
                <Send size={16} />
                Announcement
              </Button>
            )}
            {params.auction && !organization && (
              <Button onClick={() => setCompose(true)}>
                <Mail size={16} />
                New message
              </Button>
            )}
          </div>
        </div>
        {composeAnnouncement && (
          <section className="mb-5 rounded-2xl border bg-white p-5">
            <h2 className="font-semibold">Send an auction announcement</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The announcement is saved first, then emailed only to the selected
              verified audience.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_15rem]">
              <Input
                value={announcementTitle}
                onChange={(event) => setAnnouncementTitle(event.target.value)}
                placeholder="Announcement title"
                maxLength={160}
              />
              <select
                className="min-h-10 rounded-md border bg-white px-3 text-sm"
                value={announcementAudience}
                onChange={(event) =>
                  setAnnouncementAudience(event.target.value)
                }
              >
                <option value="all_registered">All registered bidders</option>
                <option value="active_bidders">Active bidders</option>
                <option value="winners">Winners</option>
                <option value="unpaid_winners">Unpaid winners</option>
              </select>
            </div>
            <Textarea
              className="mt-3 min-h-28"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Share an important auction update…"
              maxLength={4000}
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setComposeAnnouncement(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={busy || !announcementTitle.trim() || !body.trim()}
                onClick={sendAnnouncement}
              >
                {busy ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                Send announcement
              </Button>
            </div>
          </section>
        )}
        {compose && (
          <section className="mb-5 rounded-2xl border bg-white p-5">
            <h2 className="font-semibold">Ask the organizer a question</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your question stays private and connected to this auction item.
            </p>
            <Input
              className="mt-4"
              value={params.subject || "Auction question"}
              readOnly
            />
            <Textarea
              className="mt-3 min-h-28"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="How can the organizer help?"
              maxLength={4000}
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCompose(false)}>
                Cancel
              </Button>
              <Button
                disabled={busy || !body.trim()}
                onClick={() =>
                  post({
                    action: "create",
                    auctionId: params.auction,
                    itemId: params.item || null,
                    subject: params.subject || "Auction question",
                    body,
                    clientRequestId: crypto.randomUUID(),
                  })
                }
              >
                {busy ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                Send privately
              </Button>
            </div>
          </section>
        )}
        <div className="grid min-h-[620px] overflow-hidden rounded-2xl border bg-white lg:grid-cols-[22rem_1fr]">
          <aside className={`${active ? "hidden lg:block" : "block"} border-r`}>
            <div className="border-b p-4">
              <div className="relative">
                <Inbox
                  className="absolute left-3 top-3 text-muted-foreground"
                  size={16}
                />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search messages"
                />
              </div>
            </div>
            <div className="divide-y">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => {
                    setSelected(conversation.id);
                    void post({
                      action: "read",
                      conversationId: conversation.id,
                    });
                  }}
                  className={`w-full p-4 text-left hover:bg-[#f7faf8] ${selected === conversation.id ? "bg-[#eef4f0]" : ""}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong className="truncate text-sm">
                      {conversation.subject}
                    </strong>
                    {unread(conversation) && (
                      <span className="size-2 rounded-full bg-[#175b47]" />
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {conversation.messages.at(-1)?.body || "No messages yet"}
                  </p>
                  <span className="mt-2 block text-[11px] capitalize text-muted-foreground">
                    {conversation.status} ·{" "}
                    {new Date(
                      conversation.last_message_at,
                    ).toLocaleDateString()}
                  </span>
                </button>
              ))}
              {!conversations.length && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No conversations yet.
                </div>
              )}
            </div>
          </aside>
          <section
            className={`${active ? "flex" : "hidden lg:flex"} min-w-0 flex-col`}
          >
            {active ? (
              <>
                <header className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:p-5">
                  <div>
                    <button
                      className="mb-2 text-xs text-[#175b47] lg:hidden"
                      onClick={() => setSelected("")}
                    >
                      ← Inbox
                    </button>
                    <h2 className="font-semibold">{active.subject}</h2>
                    <p className="text-xs capitalize text-muted-foreground">
                      {active.status} conversation
                    </p>
                  </div>
                  {organizer && (
                    <select
                      className="min-h-10 rounded-md border bg-white px-3 text-sm"
                      value={active.status}
                      onChange={(event) =>
                        post({
                          action: "status",
                          conversationId: active.id,
                          status: event.target.value,
                        })
                      }
                    >
                      <option value="open">Open</option>
                      <option value="pending">Pending</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  )}
                </header>
                <div className="flex-1 space-y-4 overflow-auto bg-[#fafcfb] p-4 sm:p-6">
                  {active.messages.map((message) => {
                    const mine = message.sender_id === data?.currentUserId;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`group max-w-[85%] rounded-2xl px-4 py-3 ${mine ? "bg-[#175b47] text-white" : "border bg-white"}`}
                        >
                          <p className="whitespace-pre-wrap text-sm leading-6">
                            {message.body}
                          </p>
                          <div
                            className={`mt-2 flex items-center gap-3 text-[10px] ${mine ? "text-white/70" : "text-muted-foreground"}`}
                          >
                            <span>
                              {new Date(message.created_at).toLocaleString()}
                            </span>
                            {!mine && (
                              <button
                                title="Report message"
                                onClick={() =>
                                  post({
                                    action: "report",
                                    messageId: message.id,
                                    reason: "other",
                                  })
                                }
                                className="opacity-0 group-hover:opacity-100"
                              >
                                <Flag size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <footer className="border-t p-4">
                  <Textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    placeholder="Write a private reply…"
                    maxLength={4000}
                  />
                  <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                    <span>{body.length}/4000</span>
                    <Button
                      disabled={busy || !body.trim()}
                      onClick={() =>
                        post({
                          action: "send",
                          conversationId: active.id,
                          body,
                          clientRequestId: crypto.randomUUID(),
                          messageType: "user",
                        })
                      }
                    >
                      {busy ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <Send size={15} />
                      )}
                      Send
                    </Button>
                  </div>
                </footer>
              </>
            ) : (
              <div className="m-auto p-8 text-center text-muted-foreground">
                <Inbox className="mx-auto mb-3" />
                <p>Choose a conversation to begin.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

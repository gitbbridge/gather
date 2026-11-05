"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Copy,
  LoaderCircle,
  Palette,
  Plus,
  Save,
  Ticket,
  Users,
} from "lucide-react";
import Link from "next/link";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type DesignConfig = {
  version: 1;
  template: string;
  orientation: string;
  colors: { background: string; primary: string; accent: string; text: string };
  typography: { fontFamily: string; titleSize: number; bodySize: number };
  alignment: string;
  border: { radius: number; width: number; color: string };
  showOrganizationLogo: boolean;
  showEventImage: boolean;
  footerMessage: string;
};
type TicketType = {
  id: string;
  name: string;
  description: string;
  category: string;
  benefits: string;
  price_cents: number;
  capacity: number;
  admissions_per_unit: number;
  maximum_per_order: number;
  inventory_reserved: number;
  inventory_sold: number;
  sales_start_at: string | null;
  sales_end_at: string | null;
  status: string;
  visibility: string;
  guest_information_required: boolean;
  show_remaining_inventory: boolean;
  design_id: string | null;
};
type Payload = {
  auction: {
    id: string;
    name: string;
    event_starts_at: string | null;
    venue_name: string | null;
    venue_address: string | null;
    ticketing_enabled: boolean;
    event_timezone: string;
  };
  ticketTypes: TicketType[];
  designs: { id: string; name: string; config: DesignConfig }[];
  orders: {
    id: string;
    purchaser_name: string;
    purchaser_email: string;
    total_cents: number;
    status: string;
    created_at: string;
    event_tickets: {
      id: string;
      status: string;
      checked_in_at: string | null;
    }[];
  }[];
  defaultDesign: DesignConfig;
  error?: string;
};

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
const emptyTicket = {
  id: "",
  name: "",
  description: "",
  category: "General Admission",
  benefits: "",
  price: "0",
  capacity: 100,
  admissionsPerUnit: 1,
  maximumPerOrder: 10,
  salesStartAt: "",
  salesEndAt: "",
  status: "draft",
  visibility: "public",
  guestInformationRequired: true,
  showRemainingInventory: false,
  designId: "",
};

export default function TicketsClient({
  organizationId,
  auctionId,
}: {
  organizationId: string;
  auctionId: string;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [tab, setTab] = useState<"tickets" | "designer" | "orders">("tickets");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(emptyTicket);
  const [designName, setDesignName] = useState("Classic event ticket");
  const [design, setDesign] = useState<DesignConfig | null>(null);
  const [designId, setDesignId] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch(
      `/api/tickets/manage?organization=${encodeURIComponent(organizationId)}&auction=${encodeURIComponent(auctionId)}`,
    );
    const value = (await response.json()) as Payload;
    if (!response.ok) throw Error(value.error || "Unable to load ticketing.");
    setData(value);
    setDesign(
      (current) => current || value.designs[0]?.config || value.defaultDesign,
    );
    setDesignId((current) => current || value.designs[0]?.id || "");
    setDesignName(value.designs[0]?.name || "Classic event ticket");
  }, [auctionId, organizationId]);
  useEffect(() => {
    load().catch((error) => toast.error(error.message));
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const response = await fetch("/api/tickets/manage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, organizationId, auctionId }),
    });
    const value = (await response.json()) as { error?: string };
    if (!response.ok) throw Error(value.error || "Unable to save changes.");
    return value;
  };
  const saveTicket = async () => {
    setBusy(true);
    try {
      await post({
        action: "save_ticket",
        id: draft.id || undefined,
        name: draft.name,
        description: draft.description,
        category: draft.category,
        benefits: draft.benefits,
        priceCents: Math.round(Number(draft.price) * 100),
        capacity: draft.capacity,
        admissionsPerUnit: draft.admissionsPerUnit,
        maximumPerOrder: draft.maximumPerOrder,
        salesStartAt: draft.salesStartAt
          ? new Date(draft.salesStartAt).toISOString()
          : null,
        salesEndAt: draft.salesEndAt
          ? new Date(draft.salesEndAt).toISOString()
          : null,
        status: draft.status,
        visibility: draft.visibility,
        guestInformationRequired: draft.guestInformationRequired,
        showRemainingInventory: draft.showRemainingInventory,
        designId: draft.designId || designId || null,
      });
      toast.success("Ticket type saved");
      setEditing(false);
      setDraft(emptyTicket);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save ticket.",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveDesign = async () => {
    if (!design) return;
    setBusy(true);
    try {
      await post({
        action: "save_design",
        id: designId || undefined,
        name: designName,
        design,
      });
      toast.success("Ticket design saved");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save design.",
      );
    } finally {
      setBusy(false);
    }
  };
  const toggleTicketing = async () => {
    if (!data) return;
    try {
      await post({
        action: "settings",
        ticketingEnabled: !data.auction.ticketing_enabled,
        eventTimezone: data.auction.event_timezone,
      });
      toast.success(
        data.auction.ticketing_enabled
          ? "Ticket sales disabled"
          : "Ticket sales enabled",
      );
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update ticketing.",
      );
    }
  };
  const totals = useMemo(
    () => ({
      sold:
        data?.ticketTypes.reduce((sum, item) => sum + item.inventory_sold, 0) ||
        0,
      revenue:
        data?.orders
          .filter((o) => o.status === "paid")
          .reduce((sum, o) => sum + o.total_cents, 0) || 0,
      checkedIn:
        data?.orders
          .flatMap((o) => o.event_tickets || [])
          .filter((ticket) => ticket.status === "checked_in").length || 0,
    }),
    [data],
  );

  if (!organizationId || !auctionId)
    return <Empty text="Open Tickets from an event dashboard." />;
  if (!data || !design)
    return <Empty text="Loading ticket workspace…" loading />;
  return (
    <main className="min-h-screen bg-[#f5f8f6]">
      <Toaster richColors />
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link
            href={`/admin?auction=${auctionId}`}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <ArrowLeft size={15} />
            Dashboard
          </Link>
          <span className="text-2xl font-semibold text-[#175b47]">
            gather<span className="text-[#78a68b]">.</span>
          </span>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-muted-foreground">
              OPTIONAL EVENT TICKETING
            </p>
            <h1 className="mt-2 text-3xl font-semibold">
              Tickets for {data.auction.name}
            </h1>
            <p className="mt-2 text-muted-foreground">
              Sell admission separately from online auction registration.
            </p>
          </div>
          <Button
            variant={data.auction.ticketing_enabled ? "outline" : "default"}
            onClick={toggleTicketing}
          >
            {data.auction.ticketing_enabled
              ? "Disable public ticket sales"
              : "Enable ticket sales"}
          </Button>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <Metric
            label="Paid ticket units"
            value={String(totals.sold)}
            icon={<Ticket size={18} />}
          />
          <Metric
            label="Collected ticket revenue"
            value={money(totals.revenue)}
            icon={<CalendarDays size={18} />}
          />
          <Metric
            label="Guests checked in"
            value={String(totals.checkedIn)}
            icon={<Users size={18} />}
          />
        </div>
        <div className="mt-7 flex gap-2 border-b">
          {(
            [
              ["tickets", "Ticket types"],
              ["designer", "Ticket designer"],
              ["orders", "Orders & guests"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`border-b-2 px-4 py-3 text-sm font-semibold ${tab === key ? "border-[#175b47] text-[#175b47]" : "border-transparent text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "tickets" && (
          <section className="mt-6">
            <div className="flex justify-between">
              <div>
                <h2 className="text-xl font-semibold">Admission options</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create paid, group, table, or complimentary ticket types.
                </p>
              </div>
              <Button
                onClick={() => {
                  setDraft(emptyTicket);
                  setEditing(true);
                }}
              >
                <Plus size={16} />
                New ticket type
              </Button>
            </div>
            {editing && (
              <TicketEditor
                draft={draft}
                setDraft={setDraft}
                designs={data.designs}
                busy={busy}
                save={saveTicket}
                cancel={() => setEditing(false)}
              />
            )}
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {data.ticketTypes.map((ticket) => (
                <article
                  key={ticket.id}
                  className="rounded-2xl border bg-white p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="rounded-full bg-[#eaf2ed] px-2.5 py-1 text-xs font-semibold text-[#175b47]">
                        {ticket.status.replaceAll("_", " ")}
                      </span>
                      <h3 className="mt-3 text-lg font-semibold">
                        {ticket.name}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {ticket.category} · {money(ticket.price_cents)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDraft({
                          id: ticket.id,
                          name: ticket.name,
                          description: ticket.description,
                          category: ticket.category,
                          benefits: ticket.benefits,
                          price: String(ticket.price_cents / 100),
                          capacity: ticket.capacity,
                          admissionsPerUnit: ticket.admissions_per_unit,
                          maximumPerOrder: ticket.maximum_per_order,
                          salesStartAt:
                            ticket.sales_start_at?.slice(0, 16) || "",
                          salesEndAt: ticket.sales_end_at?.slice(0, 16) || "",
                          status: ticket.status,
                          visibility: ticket.visibility,
                          guestInformationRequired:
                            ticket.guest_information_required,
                          showRemainingInventory:
                            ticket.show_remaining_inventory,
                          designId: ticket.design_id || "",
                        });
                        setEditing(true);
                      }}
                    >
                      Edit
                    </Button>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-3 border-t pt-4 text-sm">
                    <div>
                      <span className="block text-muted-foreground">Sold</span>
                      <strong>{ticket.inventory_sold}</strong>
                    </div>
                    <div>
                      <span className="block text-muted-foreground">
                        Reserved
                      </span>
                      <strong>{ticket.inventory_reserved}</strong>
                    </div>
                    <div>
                      <span className="block text-muted-foreground">
                        Remaining
                      </span>
                      <strong>
                        {Math.max(
                          0,
                          ticket.capacity -
                            ticket.inventory_sold -
                            ticket.inventory_reserved,
                        )}
                      </strong>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3"
                    onClick={async () => {
                      await post({ action: "duplicate", id: ticket.id });
                      toast.success("Ticket duplicated as a draft");
                      await load();
                    }}
                  >
                    <Copy size={14} />
                    Duplicate
                  </Button>
                </article>
              ))}
            </div>
            {!data.ticketTypes.length && !editing && (
              <EmptyCard
                title="No ticket types yet"
                text="Ticketing remains completely optional. Create a ticket type only for events that need admission."
              />
            )}
          </section>
        )}

        {tab === "designer" && (
          <section className="mt-6 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
            <div className="rounded-2xl border bg-white p-5">
              <div className="flex items-center gap-2">
                <Palette size={18} className="text-[#175b47]" />
                <h2 className="font-semibold">Design controls</h2>
              </div>
              <label className="mt-5 block text-sm font-medium">
                Design name
                <Input
                  className="mt-2"
                  value={designName}
                  onChange={(e) => setDesignName(e.target.value)}
                />
              </label>
              <label className="mt-4 block text-sm font-medium">
                Template
                <select
                  className="mt-2 min-h-10 w-full rounded-md border bg-white px-3"
                  value={design.template}
                  onChange={(e) =>
                    setDesign({ ...design, template: e.target.value })
                  }
                >
                  {["classic", "modern", "minimal", "blank"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {(["primary", "accent", "background", "text"] as const).map(
                  (key) => (
                    <label key={key} className="text-sm font-medium capitalize">
                      {key}
                      <Input
                        className="mt-2 h-11"
                        type="color"
                        value={design.colors[key]}
                        onChange={(e) =>
                          setDesign({
                            ...design,
                            colors: { ...design.colors, [key]: e.target.value },
                          })
                        }
                      />
                    </label>
                  ),
                )}
              </div>
              <label className="mt-4 block text-sm font-medium">
                Footer message
                <Textarea
                  className="mt-2"
                  value={design.footerMessage}
                  onChange={(e) =>
                    setDesign({
                      ...design,
                      footerMessage: e.target.value.slice(0, 240),
                    })
                  }
                />
              </label>
              <Button className="mt-5" onClick={saveDesign} disabled={busy}>
                {busy ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : (
                  <Save size={16} />
                )}
                Save design
              </Button>
            </div>
            <div>
              <p className="mb-3 text-sm font-medium text-muted-foreground">
                Live preview — sample data only
              </p>
              <TicketPreview event={data.auction} design={design} />
            </div>
          </section>
        )}

        {tab === "orders" && (
          <section className="mt-6 rounded-2xl border bg-white">
            <div className="border-b p-5">
              <h2 className="text-xl font-semibold">Ticket orders</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Only verified paid orders count as collected revenue.
              </p>
            </div>
            {data.orders.length ? (
              <div className="divide-y">
                {data.orders.map((order) => (
                  <div
                    key={order.id}
                    className="grid gap-3 p-5 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                  >
                    <div>
                      <p className="font-semibold">{order.purchaser_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {order.purchaser_email} ·{" "}
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-sm capitalize">
                      {order.status.replaceAll("_", " ")}
                    </span>
                    <strong>{money(order.total_cents)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyCard
                title="No ticket orders yet"
                text="Paid and complimentary ticket orders will appear here."
              />
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function TicketEditor({
  draft,
  setDraft,
  designs,
  busy,
  save,
  cancel,
}: {
  draft: typeof emptyTicket;
  setDraft: (value: typeof emptyTicket) => void;
  designs: Payload["designs"];
  busy: boolean;
  save: () => void;
  cancel: () => void;
}) {
  const field = (key: keyof typeof draft, value: unknown) =>
    setDraft({ ...draft, [key]: value });
  return (
    <div className="mt-5 rounded-2xl border bg-white p-5 sm:p-7">
      <h3 className="text-xl font-semibold">
        {draft.id ? "Edit ticket type" : "Create a ticket type"}
      </h3>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Label text="Ticket name">
          <Input
            value={draft.name}
            onChange={(e) => field("name", e.target.value)}
            placeholder="General Admission"
          />
        </Label>
        <Label text="Category">
          <select
            className="min-h-10 w-full rounded-md border bg-white px-3"
            value={draft.category}
            onChange={(e) => field("category", e.target.value)}
          >
            {[
              "General Admission",
              "VIP Admission",
              "Individual Dinner Ticket",
              "Couple Admission",
              "Group Tickets",
              "Table Package",
              "Complimentary Ticket",
              "Custom",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Label>
        <Label text="Description" wide>
          <Textarea
            value={draft.description}
            onChange={(e) => field("description", e.target.value)}
          />
        </Label>
        <Label text="Included benefits" wide>
          <Textarea
            value={draft.benefits}
            onChange={(e) => field("benefits", e.target.value)}
          />
        </Label>
        <Label text="Price">
          <Input
            type="number"
            min="0"
            step=".01"
            value={draft.price}
            onChange={(e) => field("price", e.target.value)}
          />
        </Label>
        <Label text="Available quantity">
          <Input
            type="number"
            min="1"
            value={draft.capacity}
            onChange={(e) => field("capacity", Number(e.target.value))}
          />
        </Label>
        <Label text="Admissions per purchase unit">
          <Input
            type="number"
            min="1"
            max="100"
            value={draft.admissionsPerUnit}
            onChange={(e) => field("admissionsPerUnit", Number(e.target.value))}
          />
        </Label>
        <Label text="Maximum units per order">
          <Input
            type="number"
            min="1"
            max="100"
            value={draft.maximumPerOrder}
            onChange={(e) => field("maximumPerOrder", Number(e.target.value))}
          />
        </Label>
        <Label text="Sales start">
          <Input
            type="datetime-local"
            value={draft.salesStartAt}
            onChange={(e) => field("salesStartAt", e.target.value)}
          />
        </Label>
        <Label text="Sales end">
          <Input
            type="datetime-local"
            value={draft.salesEndAt}
            onChange={(e) => field("salesEndAt", e.target.value)}
          />
        </Label>
        <Label text="Status">
          <select
            className="min-h-10 w-full rounded-md border bg-white px-3"
            value={draft.status}
            onChange={(e) => field("status", e.target.value)}
          >
            {["draft", "scheduled", "on_sale", "closed", "cancelled"].map(
              (v) => (
                <option key={v} value={v}>
                  {v.replaceAll("_", " ")}
                </option>
              ),
            )}
          </select>
        </Label>
        <Label text="Ticket design">
          <select
            className="min-h-10 w-full rounded-md border bg-white px-3"
            value={draft.designId}
            onChange={(e) => field("designId", e.target.value)}
          >
            <option value="">Default design</option>
            {designs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Label>
      </div>
      <div className="mt-6 flex gap-3">
        <Button onClick={save} disabled={busy}>
          {busy ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : (
            <Check size={16} />
          )}
          Save ticket type
        </Button>
        <Button variant="outline" onClick={cancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
function TicketPreview({
  event,
  design,
}: {
  event: Payload["auction"];
  design: DesignConfig;
}) {
  return (
    <div
      className="overflow-hidden p-7 shadow-xl"
      style={{
        background: design.colors.background,
        color: design.colors.text,
        border: `${design.border.width}px solid ${design.border.color}`,
        borderRadius: design.border.radius,
        fontFamily: design.typography.fontFamily,
      }}
    >
      <div className="flex items-start justify-between gap-5">
        <div>
          <p
            className="text-xs font-bold uppercase tracking-[.2em]"
            style={{ color: design.colors.accent }}
          >
            ADMIT ONE
          </p>
          <h2
            className="mt-3 font-bold"
            style={{
              fontSize: design.typography.titleSize,
              color: design.colors.primary,
            }}
          >
            {event.name}
          </h2>
          <p className="mt-2">General Admission</p>
        </div>
        <div
          className="grid size-24 place-items-center rounded-xl border-4"
          style={{ borderColor: design.colors.primary }}
        >
          <span className="text-center text-xs font-bold">
            SECURE
            <br />
            QR CODE
          </span>
        </div>
      </div>
      <div
        className="mt-8 grid gap-4 border-t pt-5 sm:grid-cols-3"
        style={{ borderColor: design.colors.accent }}
      >
        <div>
          <small>ATTENDEE</small>
          <strong className="block">Sample Guest</strong>
        </div>
        <div>
          <small>DATE & TIME</small>
          <strong className="block">
            {event.event_starts_at
              ? new Date(event.event_starts_at).toLocaleString()
              : "Event date"}
          </strong>
        </div>
        <div>
          <small>VENUE</small>
          <strong className="block">{event.venue_name || "Event venue"}</strong>
        </div>
      </div>
      <p className="mt-7 text-xs">
        Ticket GTK-SAMPLE123 · {design.footerMessage}
      </p>
    </div>
  );
}
function Label({
  text,
  wide,
  children,
}: {
  text: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`text-sm font-medium ${wide ? "sm:col-span-2" : ""}`}>
      {text}
      <div className="mt-2">{children}</div>
    </label>
  );
}
function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </span>
      <strong className="mt-2 block text-2xl">{value}</strong>
    </div>
  );
}
function EmptyCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-5 rounded-2xl border border-dashed bg-white p-10 text-center">
      <Ticket className="mx-auto text-muted-foreground" />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
function Empty({ text, loading }: { text: string; loading?: boolean }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f8f6]">
      <div className="text-center">
        {loading && (
          <LoaderCircle className="mx-auto mb-3 animate-spin text-[#175b47]" />
        )}
        <p className="text-muted-foreground">{text}</p>
      </div>
    </main>
  );
}

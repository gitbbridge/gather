"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, LoaderCircle, Plane, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast, Toaster } from "sonner";
type Row = {
  id: string;
  status: string;
  assigned_concierge: string | null;
  supplier_confirmation_reference: string | null;
  internal_notes: string | null;
  next_follow_up_at: string | null;
  direct_offer_orders: {
    purchaser_name: string;
    purchaser_email: string;
    paid_at: string;
    gross_cents: number;
    direct_offers: {
      title: string;
      package_snapshot: { destination: string };
      organizations: { display_name: string };
    };
  };
};
const statuses = [
  "awaiting_concierge_assignment",
  "welcome_sent",
  "guest_contacted",
  "planning_in_progress",
  "awaiting_availability",
  "booking_confirmed",
  "travel_completed",
  "closed",
  "cancelled",
  "refunded",
];
const label = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
export default function DirectFulfillmentClient() {
  const [rows, setRows] = useState<Row[]>([]),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState("");
  const load = () =>
    fetch("/api/admin/give-holidays/direct-fulfillments")
      .then(async (r) => {
        const b = (await r.json()) as { fulfillments?: Row[]; error?: string };
        if (!r.ok) throw Error(b.error);
        setRows(b.fulfillments || []);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  useEffect(() => {
    void load();
  }, []);
  const save = async (id: string, form: HTMLFormElement) => {
    setSaving(id);
    const f = new FormData(form);
    try {
      const r = await fetch("/api/admin/give-holidays/direct-fulfillments", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          status: f.get("status"),
          assignedConcierge: f.get("concierge"),
          supplierConfirmationReference: f.get("reference"),
          internalNotes: f.get("notes"),
          nextFollowUpAt: f.get("followup")
            ? new Date(String(f.get("followup"))).toISOString()
            : null,
        }),
      });
      const b = (await r.json()) as { error?: string };
      if (!r.ok) throw Error(b.error);
      toast.success("Concierge record updated");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setSaving("");
    }
  };
  return (
    <main className="min-h-screen bg-[#f5f8f6] px-5 py-7">
      <Toaster richColors />
      <div className="mx-auto max-w-6xl">
        <a
          href="/admin/give-holidays"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft size={15} />
          Master catalog
        </a>
        <div className="mt-6 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-[#175b47] text-white">
            <Plane />
          </span>
          <div>
            <p className="eyebrow text-muted-foreground">GIVE HOLIDAYS ADMIN</p>
            <h1 className="text-3xl font-semibold">
              Direct-offer concierge queue
            </h1>
          </div>
        </div>
        <p className="mt-3 text-muted-foreground">
          Paid guests receive proactive outreach—no voucher submission required.
        </p>
        {loading ? (
          <LoaderCircle className="mt-8 animate-spin" />
        ) : (
          <div className="mt-8 space-y-4">
            {rows.map((row) => {
              const order = Array.isArray(row.direct_offer_orders)
                ? row.direct_offer_orders[0]
                : row.direct_offer_orders;
              const offer = Array.isArray(order?.direct_offers)
                ? order.direct_offers[0]
                : order?.direct_offers;
              const org = Array.isArray(offer?.organizations)
                ? offer.organizations[0]
                : offer?.organizations;
              return (
                <article
                  key={row.id}
                  className="rounded-2xl border bg-white p-5"
                >
                  <div className="flex flex-wrap justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#648371]">
                        {org?.display_name || "Nonprofit"} ·{" "}
                        {offer?.package_snapshot?.destination}
                      </p>
                      <h2 className="mt-1 text-xl font-semibold">
                        {offer?.title}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {order?.purchaser_name} · {order?.purchaser_email}
                      </p>
                    </div>
                    <span className="h-fit rounded-full bg-[#edf4f0] px-3 py-1.5 text-xs font-semibold text-[#175b47]">
                      {label(row.status)}
                    </span>
                  </div>
                  <form
                    className="mt-5 grid gap-3 sm:grid-cols-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void save(row.id, event.currentTarget);
                    }}
                  >
                    <label className="text-sm font-medium">
                      Status
                      <select
                        name="status"
                        defaultValue={row.status}
                        className="mt-2 min-h-10 w-full rounded-md border bg-white px-3"
                      >
                        {statuses.map((status) => (
                          <option key={status} value={status}>
                            {label(status)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-medium">
                      Assigned concierge
                      <Input
                        name="concierge"
                        className="mt-2"
                        defaultValue={row.assigned_concierge || ""}
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Supplier confirmation
                      <Input
                        name="reference"
                        className="mt-2"
                        defaultValue={row.supplier_confirmation_reference || ""}
                        placeholder="Required for Booking Confirmed"
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Next follow-up
                      <Input
                        name="followup"
                        className="mt-2"
                        type="datetime-local"
                        defaultValue={row.next_follow_up_at?.slice(0, 16) || ""}
                      />
                    </label>
                    <label className="text-sm font-medium sm:col-span-2">
                      Internal notes
                      <Textarea
                        name="notes"
                        className="mt-2"
                        defaultValue={row.internal_notes || ""}
                      />
                    </label>
                    <Button
                      className="sm:col-start-2 sm:justify-self-end"
                      disabled={saving === row.id}
                    >
                      {saving === row.id ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <Save size={15} />
                      )}
                      Save
                    </Button>
                  </form>
                </article>
              );
            })}
            {!rows.length && (
              <div className="rounded-xl border bg-white p-10 text-center text-muted-foreground">
                No paid direct offers need concierge fulfillment yet.
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

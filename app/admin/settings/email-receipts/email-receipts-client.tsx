"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  LoaderCircle,
  Monitor,
  Save,
  Send,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast, Toaster } from "sonner";

type Settings = {
  show_logo: boolean;
  logo_alignment: "left" | "center";
  thank_you_heading: string;
  thank_you_message: string;
  receipt_footer: string;
  reply_to_email: string | null;
  pending_reply_to_email: string | null;
  reply_to_verified_at: string | null;
};
type Override = {
  auction_id: string;
  inherits_defaults: boolean;
  thank_you_heading: string | null;
  thank_you_message: string | null;
  receipt_footer: string | null;
};
type Payload = {
  organization: {
    id: string;
    display_name: string;
    logo_url: string | null;
    accent_color: string | null;
  };
  settings: Settings | null;
  overrides: Override[];
  auctions: { id: string; name: string }[];
  currentUserEmail: string;
  error?: string;
};
type EmailForm = {
  showLogo: boolean;
  logoAlignment: "left" | "center";
  thankYouHeading: string;
  thankYouMessage: string;
  receiptFooter: string;
  replyToEmail: string;
  inheritsDefaults: boolean;
};
const defaults: EmailForm = {
  showLogo: true,
  logoAlignment: "left" as const,
  thankYouHeading: "Thank you for your support",
  thankYouMessage: "Your generosity makes this work possible.",
  receiptFooter: "Keep this receipt for your records.",
  replyToEmail: "",
  inheritsDefaults: true,
};
export default function EmailReceiptsClient({
  organizationId,
  verified,
}: {
  organizationId: string;
  verified: boolean;
}) {
  const [data, setData] = useState<Payload | null>(null),
    [auctionId, setAuctionId] = useState("organization"),
    [form, setForm] = useState(defaults),
    [mobile, setMobile] = useState(false),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!organizationId) return;
    const response = await fetch(
      `/api/email-settings?organization=${organizationId}`,
    );
    const value = (await response.json()) as Payload;
    if (!response.ok) throw Error(value.error || "Unable to load settings.");
    setData(value);
    setForm((current) => ({
      ...current,
      showLogo: value.settings?.show_logo ?? true,
      logoAlignment: value.settings?.logo_alignment || "left",
      thankYouHeading:
        value.settings?.thank_you_heading || defaults.thankYouHeading,
      thankYouMessage:
        value.settings?.thank_you_message || defaults.thankYouMessage,
      receiptFooter: value.settings?.receipt_footer || defaults.receiptFooter,
      replyToEmail:
        value.settings?.reply_to_email ||
        value.settings?.pending_reply_to_email ||
        "",
    }));
  }, [organizationId]);
  useEffect(() => {
    // Loading remote state is the purpose of this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((error) => toast.error(error.message));
    if (verified) toast.success("Reply-to address verified");
  }, [load, verified]);
  useEffect(() => {
    if (!data) return;
    if (auctionId === "organization") {
      // Synchronize the form when its settings scope changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((f) => ({
        ...f,
        inheritsDefaults: true,
        thankYouHeading:
          data.settings?.thank_you_heading || defaults.thankYouHeading,
        thankYouMessage:
          data.settings?.thank_you_message || defaults.thankYouMessage,
        receiptFooter: data.settings?.receipt_footer || defaults.receiptFooter,
      }));
      return;
    }
    const override = data.overrides.find(
      (item) => item.auction_id === auctionId,
    );
    setForm((f) => ({
      ...f,
      inheritsDefaults: override?.inherits_defaults ?? true,
      thankYouHeading:
        override?.thank_you_heading ||
        data.settings?.thank_you_heading ||
        defaults.thankYouHeading,
      thankYouMessage:
        override?.thank_you_message ||
        data.settings?.thank_you_message ||
        defaults.thankYouMessage,
      receiptFooter:
        override?.receipt_footer ||
        data.settings?.receipt_footer ||
        defaults.receiptFooter,
    }));
  }, [auctionId, data]);
  const selectedName = useMemo(
    () => data?.auctions.find((item) => item.id === auctionId)?.name,
    [data, auctionId],
  );
  const submit = async (action: "save" | "test") => {
    setBusy(true);
    try {
      const response = await fetch("/api/email-settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          auctionId: auctionId === "organization" ? null : auctionId,
          action,
          ...form,
        }),
      });
      const value = (await response.json()) as {
        error?: string;
        verificationSent?: boolean;
        recipient?: string;
      };
      if (!response.ok) throw Error(value.error || "Unable to save settings.");
      toast.success(
        action === "test"
          ? `Preview sent to ${value.recipient}`
          : value.verificationSent
            ? "Saved. Check the new reply-to inbox to verify it."
            : "Email settings saved.",
      );
      if (action === "save") await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save settings.",
      );
    } finally {
      setBusy(false);
    }
  };
  if (!organizationId)
    return (
      <Empty text="Open Email & Receipts from an organization dashboard." />
    );
  if (!data) return <Empty text="Loading email settings…" loading />;
  const color = data.organization.accent_color || "#175b47";
  return (
    <main className="min-h-screen bg-[#f4f7f5]">
      <Toaster richColors />
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <a
            href="/admin"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <ArrowLeft size={16} />
            Admin dashboard
          </a>
          <span className="text-2xl font-semibold text-[#175b47]">
            gather<span className="text-[#78a68b]">.</span>
          </span>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-muted-foreground">
              ORGANIZATION SETTINGS
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Email & receipts</h1>
            <p className="mt-2 text-muted-foreground">
              Create a consistent thank-you experience without editing code or
              raw HTML.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => submit("test")}
            >
              <Send size={15} />
              Send test
            </Button>
            <Button disabled={busy} onClick={() => submit("save")}>
              {busy ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Save size={15} />
              )}
              Save changes
            </Button>
          </div>
        </div>
        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,.9fr)]">
          <section className="space-y-5">
            <div className="rounded-2xl border bg-white p-5">
              <label className="text-sm font-semibold">Settings for</label>
              <select
                className="mt-2 min-h-11 w-full rounded-md border bg-white px-3"
                value={auctionId}
                onChange={(event) => setAuctionId(event.target.value)}
              >
                <option value="organization">Organization defaults</option>
                {data.auctions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              {auctionId !== "organization" && (
                <label className="mt-4 flex items-start gap-3 rounded-xl bg-[#f4f7f5] p-4">
                  <input
                    className="mt-1"
                    type="checkbox"
                    checked={form.inheritsDefaults}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        inheritsDefaults: event.target.checked,
                      })
                    }
                  />
                  <span>
                    <strong className="block text-sm">
                      Use organization defaults
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      Keep this auction synchronized with future organization
                      changes.
                    </span>
                  </span>
                </label>
              )}
            </div>
            <fieldset
              disabled={auctionId !== "organization" && form.inheritsDefaults}
              className="rounded-2xl border bg-white p-5 disabled:opacity-60"
            >
              <legend className="px-1 font-semibold">Thank-you copy</legend>
              <label className="mt-3 block text-sm font-medium">
                Heading
                <Input
                  className="mt-2"
                  value={form.thankYouHeading}
                  onChange={(event) =>
                    setForm({ ...form, thankYouHeading: event.target.value })
                  }
                  maxLength={120}
                />
              </label>
              <label className="mt-4 block text-sm font-medium">
                Message
                <Textarea
                  className="mt-2 min-h-28"
                  value={form.thankYouMessage}
                  onChange={(event) =>
                    setForm({ ...form, thankYouMessage: event.target.value })
                  }
                  maxLength={600}
                />
              </label>
              <label className="mt-4 block text-sm font-medium">
                Receipt footer
                <Textarea
                  className="mt-2"
                  value={form.receiptFooter}
                  onChange={(event) =>
                    setForm({ ...form, receiptFooter: event.target.value })
                  }
                  maxLength={400}
                />
              </label>
            </fieldset>
            {auctionId === "organization" && (
              <>
                <div className="rounded-2xl border bg-white p-5">
                  <h2 className="font-semibold">Logo treatment</h2>
                  <label className="mt-4 flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={form.showLogo}
                      onChange={(event) =>
                        setForm({ ...form, showLogo: event.target.checked })
                      }
                    />
                    Show organization logo
                  </label>
                  <div className="mt-4 flex gap-2">
                    <Button
                      type="button"
                      variant={
                        form.logoAlignment === "left" ? "default" : "outline"
                      }
                      onClick={() =>
                        setForm({ ...form, logoAlignment: "left" })
                      }
                    >
                      Align left
                    </Button>
                    <Button
                      type="button"
                      variant={
                        form.logoAlignment === "center" ? "default" : "outline"
                      }
                      onClick={() =>
                        setForm({ ...form, logoAlignment: "center" })
                      }
                    >
                      Center
                    </Button>
                  </div>
                </div>
                <div className="rounded-2xl border bg-white p-5">
                  <h2 className="font-semibold">Reply-to address</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    A new address must be verified before Gather activates it.
                  </p>
                  <Input
                    className="mt-4"
                    type="email"
                    value={form.replyToEmail}
                    onChange={(event) =>
                      setForm({ ...form, replyToEmail: event.target.value })
                    }
                    placeholder="events@yourorganization.org"
                  />
                  {data.settings?.reply_to_verified_at &&
                    data.settings.reply_to_email === form.replyToEmail && (
                      <p className="mt-2 flex items-center gap-2 text-xs font-medium text-emerald-700">
                        <Check size={13} />
                        Verified
                      </p>
                    )}
                  {data.settings?.pending_reply_to_email && (
                    <p className="mt-2 text-xs text-amber-700">
                      Verification pending for{" "}
                      {data.settings.pending_reply_to_email}
                    </p>
                  )}
                </div>
              </>
            )}
          </section>
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Receipt preview</h2>
                <p className="text-xs text-muted-foreground">
                  Sample data only
                </p>
              </div>
              <div className="flex rounded-lg border bg-white p-1">
                <button
                  aria-label="Desktop preview"
                  onClick={() => setMobile(false)}
                  className={`rounded-md p-2 ${!mobile ? "bg-[#e9f1ed] text-[#175b47]" : ""}`}
                >
                  <Monitor size={16} />
                </button>
                <button
                  aria-label="Mobile preview"
                  onClick={() => setMobile(true)}
                  className={`rounded-md p-2 ${mobile ? "bg-[#e9f1ed] text-[#175b47]" : ""}`}
                >
                  <Smartphone size={16} />
                </button>
              </div>
            </div>
            <div
              className={`mx-auto overflow-hidden rounded-2xl border bg-[#eef3f0] p-4 transition-all ${mobile ? "max-w-[390px]" : "max-w-full"}`}
            >
              <div className="rounded-xl bg-white p-6 shadow-sm">
                {form.showLogo && (
                  <div
                    className={`mb-6 flex ${form.logoAlignment === "center" ? "justify-center" : "justify-start"}`}
                  >
                    {data.organization.logo_url ? (
                      <img
                        src={data.organization.logo_url}
                        alt=""
                        className="max-h-12 max-w-48 object-contain"
                      />
                    ) : (
                      <strong style={{ color }}>
                        {data.organization.display_name}
                      </strong>
                    )}
                  </div>
                )}
                <p
                  className="text-[10px] font-bold uppercase tracking-[.18em]"
                  style={{ color }}
                >
                  PAYMENT COMPLETE
                </p>
                <h3 className="mt-3 text-2xl font-semibold">
                  {form.thankYouHeading}
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {form.thankYouMessage}
                </p>
                <div className="mt-5 rounded-lg border">
                  <Row label="Receipt" value="GTH-PREVIEW" />
                  <Row
                    label="Auction"
                    value={selectedName || "Spring for Good"}
                  />
                  <Row label="Winning bids" value="$120.00" />
                  <Row label="Gather fee" value="$5.00" />
                  <Row label="Processing fee" value="$0.00" />
                  <Row label="Total paid" value="$125.00" last />
                </div>
                <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">
                  {form.receiptFooter}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Financial values come from the verified Stripe transaction and
              cannot be edited here.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
function Row({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-3 px-3 py-2.5 text-xs ${last ? "" : "border-b"}`}
    >
      <span className="text-muted-foreground">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Empty({ text, loading }: { text: string; loading?: boolean }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f7f5] p-6">
      <div className="rounded-2xl border bg-white p-8 text-center text-muted-foreground">
        {loading && <LoaderCircle className="mx-auto mb-3 animate-spin" />}
        {text}
      </div>
    </main>
  );
}

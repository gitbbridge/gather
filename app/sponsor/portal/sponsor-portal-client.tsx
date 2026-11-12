"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CreditCard, Heart, Leaf, LoaderCircle, LockKeyhole, ReceiptText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Coverage = "platform" | "processing" | "both";
type PortalData = {
  invitation: {
    status: string;
    contactName: string;
    requestedCoverage: Coverage;
    proposedMaximumCents: number;
    coverageStartsAt: string | null;
    coverageEndsAt: string | null;
    invitationMessage: string;
  };
  organization: { name: string; accentColor: string };
  auction: { name: string; eventStartsAt: string | null; closesAt: string | null };
  sponsor: { name: string; logoUrl: string | null; websiteUrl: string | null };
  agreement: null | {
    id: string;
    coverage: Coverage;
    maximum_cents: number;
    allocated_cents: number;
    charged_cents: number;
    refunded_cents: number;
    billing_contact_name: string;
    billing_contact_email: string;
    status: string;
    hasPaymentMethod: boolean;
    sponsor_billing_statements: { id: string; statement_number: string; amount_cents: number; status: string; issued_at: string | null; paid_at: string | null }[];
  };
  error?: string;
};

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export default function SponsorPortalClient() {
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [coverage, setCoverage] = useState<Coverage>("platform");
  const [maximum, setMaximum] = useState("0");
  const [billingName, setBillingName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/sponsors/portal", { cache: "no-store" });
    const value = (await response.json()) as PortalData;
    if (!response.ok) throw Error(value.error || "Unable to load sponsor portal.");
    setData(value);
    setCoverage(value.agreement?.coverage || value.invitation.requestedCoverage);
    setMaximum(String((value.agreement?.maximum_cents || value.invitation.proposedMaximumCents) / 100));
    setBillingName(value.agreement?.billing_contact_name || value.invitation.contactName);
    setBillingEmail(value.agreement?.billing_contact_email || "");
  }, []);
  useEffect(() => {
    load().catch((reason) => setError(reason.message));
  }, [load]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (params.get("setup") !== "success" || !sessionId) return;
    setBusy(true);
    fetch("/api/sponsors/portal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "refresh_setup", checkoutSessionId: sessionId }),
    })
      .then(async (response) => {
        const value = (await response.json()) as { error?: string };
        if (!response.ok) throw Error(value.error || "Stripe authorization is not complete.");
        window.history.replaceState({}, "", "/sponsor/portal");
        await load();
      })
      .catch((reason) => setError(reason.message))
      .finally(() => setBusy(false));
  }, [load]);

  const remaining = useMemo(
    () => Math.max(0, (data?.agreement?.maximum_cents || 0) - (data?.agreement?.allocated_cents || 0)),
    [data],
  );
  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/sponsors/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const value = (await response.json()) as { error?: string; url?: string; counteroffer?: boolean };
      if (!response.ok) throw Error(value.error || "Unable to save sponsorship.");
      if (value.url) window.location.assign(value.url);
      else await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save sponsorship.");
    } finally {
      setBusy(false);
    }
  };

  if (error && !data) return <PortalMessage title="Sponsor access unavailable" text={error} />;
  if (!data) return <PortalMessage title="Opening your sponsor portal" text="Loading the invitation securely…" loading />;
  const pendingApproval = data.agreement?.status === "pending_organizer_approval";
  const active = data.agreement?.status === "active" || data.agreement?.status === "exhausted";
  return (
    <main className="min-h-screen bg-[#f6f8f6] text-[#203129]">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2 text-2xl font-semibold text-[#175b47]"><Leaf size={20} />gather<span className="text-[#78a68b]">.</span></div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole size={14} /> Secure Sponsorship Portal</div>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-5 py-10 sm:py-14">
        <p className="eyebrow text-[#175b47]">A SPECIAL INVITATION</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">Help More of Every Dollar Make a Difference.</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
          You’ve been invited to help {data.organization.name} cover eligible transaction fees for {data.auction.name}, allowing more fundraising proceeds to support its mission.
        </p>
        {error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        <section className="mt-8 rounded-2xl border bg-white p-6 sm:p-7">
          <div className="flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#eaf3ed] text-xl font-semibold text-[#175b47]">
              {data.sponsor.logoUrl ? <img src={data.sponsor.logoUrl} alt={`${data.sponsor.name} logo`} className="size-full object-contain p-2" /> : data.sponsor.name.slice(0, 1)}
            </span>
            <div><p className="font-semibold">{data.sponsor.name}</p><p className="mt-1 text-sm text-muted-foreground">{data.auction.name} · Hosted by {data.organization.name}</p></div>
          </div>
          {data.invitation.invitationMessage && <p className="mt-5 border-t pt-5 text-sm leading-6 text-muted-foreground">{data.invitation.invitationMessage}</p>}
        </section>

        {!data.agreement && data.invitation.status !== "declined" && (
          <>
            <section className="mt-5 rounded-2xl border bg-white p-6 sm:p-7">
              <h2 className="text-lg font-semibold">1. Choose Your Fee Coverage</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {([
                  ["platform", "Gather Platform Fees", "Help cover Gather’s 5% platform fee, capped at $100 per eligible winning item."],
                  ["processing", "Payment Processing Fees", "Help reimburse actual eligible Stripe processing expenses."],
                  ["both", "Both Fee Categories", "Support both eligible platform and payment-processing expenses."],
                ] as const).map(([key, label, description]) => (
                  <button key={key} onClick={() => setCoverage(key)} className={`rounded-xl border p-4 text-left ${coverage === key ? "border-2 border-[#175b47] bg-[#eef5f0]" : "bg-white"}`}>
                    <span className="flex items-center gap-2 font-semibold">{coverage === key && <Check size={16} />} {label}</span>
                    <span className="mt-2 block text-xs leading-5 text-muted-foreground">{description}</span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Changing the nonprofit’s requested coverage creates a counteroffer requiring approval.</p>
            </section>
            <section className="mt-5 rounded-2xl border bg-white p-6 sm:p-7">
              <h2 className="text-lg font-semibold">2. Set Your Sponsorship Maximum</h2>
              <label className="mt-5 block max-w-xs text-sm font-medium">Maximum authorized commitment
                <div className="mt-2 flex overflow-hidden rounded-xl border"><span className="bg-[#f5f7f5] px-4 py-3 text-muted-foreground">$</span><Input type="number" min="1" max={data.invitation.proposedMaximumCents / 100} className="h-12 rounded-none border-0 text-lg font-semibold" value={maximum} onChange={(event) => setMaximum(event.target.value)} /></div>
              </label>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">Your total authorized sponsorship charges will never exceed this amount without additional approval.</p>
            </section>
            <section className="mt-5 rounded-2xl border bg-white p-6 sm:p-7">
              <h2 className="text-lg font-semibold">3. Review and Confirm</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium">Billing contact<Input className="mt-2" value={billingName} onChange={(event) => setBillingName(event.target.value)} /></label>
                <label className="text-sm font-medium">Billing email<Input className="mt-2" type="email" value={billingEmail} onChange={(event) => setBillingEmail(event.target.value)} /></label>
              </div>
              <div className="mt-5 rounded-xl bg-[#eef5f0] p-5 text-sm"><div className="flex justify-between"><span>Supporting</span><strong>{data.organization.name}</strong></div><div className="mt-3 flex justify-between"><span>Maximum</span><strong>{money(Math.round(Number(maximum) * 100 || 0))}</strong></div><div className="mt-3 flex justify-between"><span>Billing</span><strong>End-of-event settlement</strong></div></div>
              <label className="mt-5 flex gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 size-4 accent-[#175b47]" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I understand and authorize the sponsorship commitment, maximum amount, billing schedule, and applicable future charges described above.</span></label>
              <Button className="mt-5 w-full" disabled={busy || !consent || !billingName || !billingEmail} onClick={() => post({ action: "accept", coverage, maximumCents: Math.round(Number(maximum) * 100), billingContactName: billingName, billingContactEmail: billingEmail, consent: true })}>{busy ? <LoaderCircle className="animate-spin" size={16} /> : <Heart size={16} />} Accept sponsorship terms</Button>
              <Button variant="ghost" className="mt-2 w-full" disabled={busy} onClick={() => post({ action: "decline" })}>Decline invitation</Button>
            </section>
          </>
        )}

        {data.agreement && (
          <section className="mt-5 rounded-2xl border bg-white p-6 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow text-[#175b47]">SPONSORSHIP AGREEMENT</p><h2 className="mt-2 text-2xl font-semibold">{active ? "Your sponsorship is active" : pendingApproval ? "Awaiting nonprofit approval" : "Authorize your payment method"}</h2></div><span className="rounded-full bg-[#eef5f0] px-3 py-1.5 text-xs font-semibold capitalize text-[#175b47]">{data.agreement.status.replaceAll("_", " ")}</span></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3"><Metric label="Authorized maximum" value={money(data.agreement.maximum_cents)} icon={<ShieldCheck size={17} />} /><Metric label="Allocated fees" value={money(data.agreement.allocated_cents)} icon={<ReceiptText size={17} />} /><Metric label="Remaining coverage" value={money(remaining)} icon={<Heart size={17} />} /></div>
            {pendingApproval && <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">You proposed different terms. No sponsorship coverage will activate until {data.organization.name} approves the counteroffer.</p>}
            {data.agreement.status === "pending_payment_method" && <div className="mt-6 rounded-xl border bg-[#fafbf9] p-5"><div className="flex items-start gap-3"><CreditCard className="mt-0.5 text-[#175b47]" /><div><h3 className="font-semibold">Securely authorize your payment method</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Stripe securely saves your card. This does not create an immediate charge, and total future charges cannot exceed {money(data.agreement.maximum_cents)}.</p></div></div><Button className="mt-5" disabled={busy} onClick={() => post({ action: "start_setup" })}>{busy ? <LoaderCircle className="animate-spin" size={16} /> : <LockKeyhole size={16} />} Continue securely with Stripe</Button></div>}
            {active && <div className="mt-6 flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900"><ShieldCheck size={20} /> Payment method authorized through Stripe. No raw card details are stored by Gather.</div>}
            {!!data.agreement.sponsor_billing_statements?.length && <div className="mt-7"><h3 className="font-semibold">Statements and receipts</h3><div className="mt-3 divide-y rounded-xl border">{data.agreement.sponsor_billing_statements.map((statement) => <div key={statement.id} className="flex items-center justify-between gap-4 p-4 text-sm"><div><strong>{statement.statement_number}</strong><p className="mt-1 capitalize text-muted-foreground">{statement.status.replaceAll("_", " ")}</p></div><strong>{money(statement.amount_cents)}</strong></div>)}</div></div>}
          </section>
        )}
        <footer className="py-8 text-center text-xs text-muted-foreground">Powered by Gather · Secure Sponsorship Management</footer>
      </div>
    </main>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="rounded-xl border p-4"><span className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</span><strong className="mt-2 block text-lg">{value}</strong></div>;
}

function PortalMessage({ title, text, loading = false }: { title: string; text: string; loading?: boolean }) {
  return <main className="grid min-h-screen place-items-center bg-[#f6f8f6] px-5"><section className="max-w-md rounded-2xl border bg-white p-8 text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-[#eaf3ed] text-[#175b47]">{loading ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}</span><h1 className="mt-5 text-2xl font-semibold">{title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p></section></main>;
}

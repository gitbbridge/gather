"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  LoaderCircle,
  MapPin,
  Minus,
  Plus,
  Ticket,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TicketType = {
  id: string;
  name: string;
  description: string;
  category: string;
  benefits: string;
  price_cents: number;
  maximum_per_order: number;
  admissions_per_unit: number;
  effectiveStatus: string;
  remaining: number | null;
  terms_version: string;
};
type Payload = {
  auction: {
    name: string;
    description: string;
    event_starts_at: string | null;
    venue_name: string | null;
    venue_address: string | null;
    event_timezone: string;
    organizations: { display_name: string; accent_color: string };
  };
  tickets: TicketType[];
  error?: string;
};
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );

export default function TicketsPublicClient({
  auctionId,
  organizationSlug,
}: {
  auctionId: string;
  organizationSlug: string;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`/api/tickets/public?auction=${encodeURIComponent(auctionId)}`)
      .then(async (response) => {
        const value = (await response.json()) as Payload;
        if (!response.ok) throw Error(value.error || "Tickets unavailable.");
        setData(value);
      })
      .catch((reason) => setError(reason.message));
  }, [auctionId]);
  const selected = useMemo(
    () =>
      data?.tickets.filter((ticket) => (quantities[ticket.id] || 0) > 0) || [],
    [data, quantities],
  );
  const total = selected.reduce(
    (sum, ticket) => sum + ticket.price_cents * (quantities[ticket.id] || 0),
    0,
  );
  const checkout = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/tickets/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          auctionId,
          organizationSlug,
          ...contact,
          lines: selected.map((ticket) => ({
            ticketTypeId: ticket.id,
            quantity: quantities[ticket.id],
          })),
        }),
      });
      const value = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !value.url)
        throw Error(value.error || "Unable to begin checkout.");
      window.location.assign(value.url);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to begin checkout.",
      );
      setBusy(false);
    }
  };
  if (error && !data)
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="max-w-md text-center">
          <Ticket className="mx-auto text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-semibold">Tickets unavailable</h1>
          <p className="mt-2 text-muted-foreground">{error}</p>
          <Button asChild className="mt-5">
            <Link href={`/n/${organizationSlug}/auction/${auctionId}`}>
              Return to auction
            </Link>
          </Button>
        </div>
      </main>
    );
  if (!data)
    return (
      <main className="grid min-h-screen place-items-center">
        <LoaderCircle className="animate-spin text-[#175b47]" />
      </main>
    );
  const purchaseSuccess =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("purchase") === "success";
  return (
    <main className="min-h-screen bg-[#f5f8f6]">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link
            href={`/n/${organizationSlug}/auction/${auctionId}`}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <ArrowLeft size={15} />
            Auction
          </Link>
          <span className="text-2xl font-semibold text-[#175b47]">
            gather<span className="text-[#78a68b]">.</span>
          </span>
        </div>
      </header>
      <section className="bg-[#123e33] px-5 py-12 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#a9d3bd]">
            {data.auction.organizations?.display_name} presents
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold">
            {data.auction.name} tickets
          </h1>
          <div className="mt-5 flex flex-wrap gap-5 text-sm text-white/80">
            {data.auction.event_starts_at && (
              <span className="flex items-center gap-2">
                <CalendarDays size={16} />
                {new Date(data.auction.event_starts_at).toLocaleString()} ·{" "}
                {data.auction.event_timezone}
              </span>
            )}
            {data.auction.venue_name && (
              <span className="flex items-center gap-2">
                <MapPin size={16} />
                {data.auction.venue_name}
              </span>
            )}
          </div>
          <p className="mt-5 max-w-2xl text-white/80">
            Admission tickets are optional and separate from online auction
            registration. Remote supporters can bid without purchasing
            admission.
          </p>
        </div>
      </section>
      <div className="mx-auto grid max-w-6xl gap-7 px-5 py-9 lg:grid-cols-[1fr_360px]">
        <section>
          <h2 className="text-2xl font-semibold">Choose your tickets</h2>
          {purchaseSuccess && (
            <div className="mt-5 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <CheckCircle2 className="shrink-0" />
              <div>
                <strong>Purchase confirmed</strong>
                <p className="mt-1 text-sm">
                  Your individual tickets are being prepared and will be
                  delivered by email.
                </p>
              </div>
            </div>
          )}
          <div className="mt-5 space-y-4">
            {data.tickets.map((ticket) => {
              const available = ticket.effectiveStatus === "on_sale";
              const quantity = quantities[ticket.id] || 0;
              return (
                <article
                  key={ticket.id}
                  className="rounded-2xl border bg-white p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-xl">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#56766a]">
                        {ticket.category}
                      </p>
                      <h3 className="mt-1 text-xl font-semibold">
                        {ticket.name}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {ticket.description}
                      </p>
                      {ticket.benefits && (
                        <p className="mt-3 text-sm">
                          <strong>Includes:</strong> {ticket.benefits}
                        </p>
                      )}
                      <p className="mt-3 font-semibold">
                        {money(ticket.price_cents)}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          per purchase unit
                          {ticket.admissions_per_unit > 1
                            ? ` · ${ticket.admissions_per_unit} admissions each`
                            : ""}
                        </span>
                      </p>
                      {ticket.remaining !== null && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {ticket.remaining} remaining
                        </p>
                      )}
                    </div>
                    {available ? (
                      <div className="flex items-center rounded-full border">
                        <button
                          className="grid size-10 place-items-center"
                          onClick={() =>
                            setQuantities({
                              ...quantities,
                              [ticket.id]: Math.max(0, quantity - 1),
                            })
                          }
                        >
                          <Minus size={15} />
                        </button>
                        <strong className="w-8 text-center">{quantity}</strong>
                        <button
                          className="grid size-10 place-items-center"
                          onClick={() =>
                            setQuantities({
                              ...quantities,
                              [ticket.id]: Math.min(
                                ticket.maximum_per_order,
                                ticket.remaining ?? ticket.maximum_per_order,
                                quantity + 1,
                              ),
                            })
                          }
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                    ) : (
                      <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold capitalize">
                        {ticket.effectiveStatus.replaceAll("_", " ")}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
            {!data.tickets.length && (
              <p className="rounded-xl border border-dashed bg-white p-8 text-center text-muted-foreground">
                No public tickets are available yet.
              </p>
            )}
          </div>
        </section>
        <aside className="h-fit rounded-2xl border bg-white p-5 lg:sticky lg:top-5">
          <h2 className="text-lg font-semibold">Order summary</h2>
          {selected.length ? (
            <div className="mt-4 space-y-3">
              {selected.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex justify-between gap-3 text-sm"
                >
                  <span>
                    {quantities[ticket.id]} × {ticket.name}
                  </span>
                  <strong>
                    {money(ticket.price_cents * quantities[ticket.id])}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Select a ticket to begin.
            </p>
          )}
          <div className="mt-5 flex justify-between border-t pt-4">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
          <div className="mt-5 space-y-3">
            <Input
              placeholder="Purchaser name"
              value={contact.name}
              onChange={(e) => setContact({ ...contact, name: e.target.value })}
            />
            <Input
              type="email"
              placeholder="Email for ticket delivery"
              value={contact.email}
              onChange={(e) =>
                setContact({ ...contact, email: e.target.value })
              }
            />
            <Input
              type="tel"
              placeholder="Phone (optional)"
              value={contact.phone}
              onChange={(e) =>
                setContact({ ...contact, phone: e.target.value })
              }
            />
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <Button
            className="mt-5 w-full"
            size="lg"
            disabled={
              !selected.length || !contact.name || !contact.email || busy
            }
            onClick={checkout}
          >
            {busy ? (
              <LoaderCircle className="animate-spin" />
            ) : total === 0 ? (
              "Reserve complimentary tickets"
            ) : (
              "Continue to secure payment"
            )}
          </Button>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Ticket sales do not use Gather’s 5% auction commission. Any
            payment-processing charges are disclosed separately before payment.
          </p>
        </aside>
      </div>
    </main>
  );
}

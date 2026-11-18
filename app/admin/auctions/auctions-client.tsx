"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, ExternalLink, History } from "lucide-react";
import { OrganizerShell } from "@/components/organizer-shell";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/auction";

type AuctionSummary = {
  id: string;
  name: string;
  organization: string;
  ends: number;
  items: number;
  bids: number;
  total: number;
  status: "open" | "scheduled" | "paused" | "closed";
};

type AdminData = {
  id: string;
  nonprofit: { id: string; name: string; slug: string } | null;
  list: AuctionSummary[];
  state: { name: string };
};

export default function AuctionsClient() {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("auction");
    fetch(`/api/auction${id ? `?id=${encodeURIComponent(id)}` : ""}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load past auctions.");
        setData((await response.json()) as AdminData);
      })
      .catch(() => setError("Past auctions could not be loaded. Please try again."));
  }, []);

  if (error) return <main className="grid min-h-screen place-items-center p-6 text-red-700">{error}</main>;
  if (!data) return <main className="p-10 text-muted-foreground">Loading past auctions…</main>;

  const auctions = (data.list || []).filter((auction) => auction.id !== data.id);
  if (!data.nonprofit) return <main className="p-10">No nonprofit workspace is available.</main>;

  return (
    <OrganizerShell
      auctionId={data.id}
      auctionName={data.state.name}
      organizationId={data.nonprofit.id}
      organizationName={data.nonprofit.name}
      nonprofitSlug={data.nonprofit.slug}
      activeItem="Past auctions"
    >
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-2 text-muted-foreground">AUCTION ARCHIVE</p>
            <h1 className="text-3xl font-semibold tracking-tight">Past auctions</h1>
            <p className="mt-2 text-muted-foreground">Review results, reopen a workspace, or visit an earlier auction page.</p>
          </div>
          <Button asChild><a href="/onboarding">New auction <ArrowUpRight size={16} /></a></Button>
        </header>

        <section className="overflow-hidden rounded-xl border bg-white">
          {auctions.length ? (
            <div className="divide-y">
              {auctions.map((auction) => (
                <article key={auction.id} className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-semibold">{auction.name}</h2>
                      <Status status={auction.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{auction.organization} · Ended {new Date(auction.ends).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                      <span>{auction.items} items</span><span>{auction.bids} bids</span><span>{money(auction.total)} in test commitments</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <Button variant="outline" asChild><a href={`/?auction=${encodeURIComponent(auction.id)}`} target="_blank" rel="noreferrer">View auction <ExternalLink size={15} /></a></Button>
                    <Button asChild><a href={`/admin?auction=${encodeURIComponent(auction.id)}`}>Open dashboard <ArrowRight size={15} /></a></Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="px-6 py-16 text-center">
              <History className="mx-auto text-muted-foreground" />
              <p className="mt-3 font-medium">No past auctions yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Completed and earlier auctions will remain available here.</p>
            </div>
          )}
        </section>
      </div>
    </OrganizerShell>
  );
}

function Status({ status }: { status: AuctionSummary["status"] }) {
  const styles = status === "open" ? "bg-emerald-50 text-emerald-700" : status === "closed" ? "bg-slate-100 text-slate-600" : status === "paused" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${styles}`}>{status}</span>;
}

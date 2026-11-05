"use client";

import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  CreditCard,
  ExternalLink,
  HandCoins,
  Handshake,
  History,
  LayoutTemplate,
  Mail,
  MessageSquare,
  Plane,
  Ticket,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type AdminDashboardProps = {
  auction: {
    name: string;
    organization: string;
    items: number;
    bidders: number;
    bids: number;
    total: string;
    goal: string;
    progress: number;
    paused: boolean;
    ends: string;
  };
  previousAuctions: {
    id: string;
    name: string;
    organization: string;
    status: "open" | "scheduled" | "paused" | "closed";
    items: number;
    bids: number;
    total: string;
    endsLabel: string;
  }[];
  nonprofit?: { name: string; slug: string } | null;
  payment?: {
    status: "not_connected" | "pending" | "ready" | "restricted";
    cardPaymentsStatus: string;
    payoutsStatus: string;
    livemode: boolean;
  } | null;
  connectingPayments: boolean;
  onManageItems: () => void;
  onManagePage: () => void;
  onCreateAuction: () => void;
  onSettlement: () => void;
  onSupporters: () => void;
  onMessages: () => void;
  onEmailSettings: () => void;
  onDirectOffers: () => void;
  onTickets: () => void;
  onSponsors: () => void;
  onHomepage: () => void;
  onConnectPayments: () => void;
  onOpenAuction: (auctionId: string) => void;
  onViewAuction: (auctionId: string) => void;
};

// Selected Tailwind UI Plus patterns:
// - page-examples/home-screens/sidebar_on_dark.jsx for the admin shell rhythm
// - data-display/stats/with_trending.jsx for compact metric cards
// - headings/section-headings/with_actions.jsx for action-led section headers
// - layout/list-containers/separate_cards.jsx for operational checklists
export function AdminDashboard({
  auction,
  previousAuctions,
  nonprofit,
  payment,
  connectingPayments,
  onManageItems,
  onManagePage,
  onCreateAuction,
  onSettlement,
  onSupporters,
  onMessages,
  onEmailSettings,
  onDirectOffers,
  onTickets,
  onSponsors,
  onHomepage,
  onConnectPayments,
  onOpenAuction,
  onViewAuction,
}: AdminDashboardProps) {
  const checks = [
    {
      label: "Auction page",
      detail: nonprofit
        ? "Edit and publish your branded auction page"
        : "Create your shareable auction page",
      done: Boolean(nonprofit),
      action: nonprofit ? onHomepage : onManagePage,
    },
    {
      label: "Auction items",
      detail: auction.items
        ? `${auction.items} items listed`
        : "Add your first item",
      done: auction.items > 0,
      action: onManageItems,
    },
    {
      label: "Bidder access",
      detail: "Registration is required before bidding",
      done: true,
      action: onManagePage,
    },
    {
      label: "Payments",
      detail:
        payment?.status === "ready"
          ? "Stripe is ready for winning-bid payments"
          : payment?.status === "pending"
            ? "Finish Stripe verification"
            : "Connect the nonprofit’s Stripe account",
      done: payment?.status === "ready",
      action: onConnectPayments,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-muted-foreground mb-2">
            ORGANIZER WORKSPACE
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Your auction at a glance
          </h1>
          <p className="mt-2 text-muted-foreground">
            Keep {auction.name} moving forward.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <Button variant="outline" onClick={onHomepage} disabled={!nonprofit}>
            <LayoutTemplate size={16} />
            Auction page
          </Button>
          <Button variant="outline" onClick={onMessages} disabled={!nonprofit}>
            <MessageSquare size={16} />
            Messages
          </Button>
          <Button variant="outline" onClick={onSupporters}>
            <Users size={16} />
            Supporters
          </Button>
          <Button
            variant="outline"
            onClick={onEmailSettings}
            disabled={!nonprofit}
          >
            <Mail size={16} />
            Email & receipts
          </Button>
          <Button
            variant="outline"
            onClick={onDirectOffers}
            disabled={!nonprofit}
          >
            <Plane size={16} />
            Direct offers
          </Button>
          <Button variant="outline" onClick={onTickets} disabled={!nonprofit}>
            <Ticket size={16} />
            Tickets
          </Button>
          <Button variant="outline" onClick={onSponsors} disabled={!nonprofit}>
            <Handshake size={16} />
            Sponsors
          </Button>
          <Button variant="outline" onClick={onSettlement}>
            <HandCoins size={16} />
            Close out event
          </Button>
          <Button onClick={onCreateAuction}>
            <ArrowUpRight size={16} />
            New auction
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-[#e0e7e2] sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Test commitments"
          value={auction.total}
          detail={`of ${auction.goal} goal`}
        />
        <Metric
          label="Auction items"
          value={String(auction.items)}
          detail="Across your catalog"
        />
        <Metric
          label="Participating bidders"
          value={String(auction.bidders)}
          detail={`${auction.bids} bids so far`}
        />
        <Metric
          label="Auction status"
          value={auction.paused ? "Paused" : "Open"}
          detail={auction.ends}
          tone={auction.paused ? "warning" : "positive"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <section className="panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow text-muted-foreground mb-2">
                FUNDRAISING PROGRESS
              </p>
              <h2 className="text-xl font-semibold">
                You’re building momentum
              </h2>
            </div>
            <span className="text-lg font-semibold">{auction.progress}%</span>
          </div>
          <Progress
            value={auction.progress}
            className="mt-6 h-2 bg-[#e5eee8]"
          />
          <div className="mt-4 flex justify-between text-sm text-muted-foreground">
            <span>{auction.total} raised in test commitments</span>
            <span>{auction.goal} target</span>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button onClick={onManageItems}>
              Review items <ArrowUpRight size={16} />
            </Button>
            {nonprofit && (
              <Button variant="outline" asChild>
                <a
                  href={`/n/${nonprofit.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View live auction page <ExternalLink size={16} />
                </a>
              </Button>
            )}
          </div>
        </section>
        <section className="panel">
          <div className="flex items-center gap-2 mb-5">
            <Users size={18} className="text-primary" />
            <h2 className="font-semibold">Launch checklist</h2>
          </div>
          <div className="space-y-4">
            {checks.map((check) => (
              <button
                key={check.label}
                onClick={check.action}
                className="flex w-full items-start gap-3 text-left rounded-lg p-2 -m-2 hover:bg-muted"
              >
                <span className="mt-0.5">
                  {check.done ? (
                    <CheckCircle2 size={18} className="text-[#2f7d5b]" />
                  ) : (
                    <CircleAlert size={18} className="text-amber-600" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {check.label}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-1">
                    {check.detail}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="panel p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#eaf1ed] text-[#175b47]">
              <History size={19} />
            </span>
            <div>
              <h2 className="font-semibold">Previous auctions</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Reopen any earlier workspace, review results, or view its
                auction page.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={onCreateAuction}>
            New auction <ArrowUpRight size={15} />
          </Button>
        </div>
        {previousAuctions.length ? (
          <div className="divide-y">
            {previousAuctions.map((previous) => (
              <article
                key={previous.id}
                className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold">{previous.name}</h3>
                    <Status status={previous.status} />
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {previous.organization} · Ends {previous.endsLabel}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                    <span>{previous.items} items</span>
                    <span>{previous.bids} bids</span>
                    <span>{previous.total} in test commitments</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Button
                    variant="outline"
                    onClick={() => onViewAuction(previous.id)}
                  >
                    View auction <ExternalLink size={15} />
                  </Button>
                  <Button onClick={() => onOpenAuction(previous.id)}>
                    Open dashboard <ArrowRight size={15} />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="px-6 py-10 text-center">
            <History className="mx-auto text-muted-foreground" />
            <p className="mt-3 font-medium">No previous auctions yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Earlier auctions will stay available here.
            </p>
          </div>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="panel">
          <div className="flex items-start gap-3">
            <Clock3 className="text-primary mt-0.5" size={19} />
            <div>
              <h2 className="font-semibold">Ready for your own fundraiser?</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Create another auction under the same nonprofit page for
                seasonal campaigns, galas, or year-round giving.
              </p>
              <Button
                variant="link"
                className="px-0 mt-3"
                onClick={onCreateAuction}
              >
                Create an auction <ArrowUpRight size={15} />
              </Button>
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="flex items-start gap-3">
            <CreditCard className="text-primary mt-0.5" size={19} />
            <div>
              <h2 className="font-semibold">
                {payment?.status === "ready"
                  ? "Payments connected"
                  : "Connect winning-bid payments"}
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                {payment?.status === "ready"
                  ? `Stripe can accept payments and send payouts${payment.livemode ? "." : " in test mode."}`
                  : payment?.status === "pending"
                    ? "Stripe still needs verification details before this nonprofit can accept payments and receive payouts."
                    : payment?.status === "restricted"
                      ? "Stripe needs updated information before payments can be enabled."
                      : "Stripe securely collects nonprofit verification and bank details. Gather never stores card or bank information."}
              </p>
              <Button
                variant={payment?.status === "ready" ? "outline" : "default"}
                className="mt-4"
                onClick={onConnectPayments}
                disabled={!nonprofit || connectingPayments}
              >
                {connectingPayments
                  ? "Opening Stripe…"
                  : payment?.status === "ready"
                    ? "Review Stripe setup"
                    : payment?.status === "pending" ||
                        payment?.status === "restricted"
                      ? "Continue Stripe setup"
                      : "Connect Stripe"}{" "}
                <ArrowUpRight size={15} />
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">
                Gather’s 5% fee is separate from Stripe processing fees.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Status({
  status,
}: {
  status: "open" | "scheduled" | "paused" | "closed";
}) {
  const styles =
    status === "open"
      ? "bg-emerald-50 text-emerald-700"
      : status === "closed"
        ? "bg-slate-100 text-slate-600"
        : status === "paused"
          ? "bg-amber-50 text-amber-700"
          : "bg-blue-50 text-blue-700";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${styles}`}
    >
      {status}
    </span>
  );
}

function Metric({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "positive" | "warning";
}) {
  return (
    <div className="bg-white px-5 py-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span
          className={`size-2 rounded-full ${tone === "positive" ? "bg-[#2f7d5b]" : tone === "warning" ? "bg-amber-500" : "bg-[#a8bbb0]"}`}
        />
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { AdminDashboard } from "@/components/tailwind-ui/admin-dashboard";
import { money } from "@/lib/auction";
import { toast } from "sonner";

type AuctionSummary = {
  id: string;
  name: string;
  organization: string;
  starts: number;
  ends: number;
  paused: boolean;
  items: number;
  bids: number;
  total: number;
  status: "open" | "scheduled" | "paused" | "closed";
};
type PaymentConnection = {
  status: "not_connected" | "pending" | "ready" | "restricted";
  cardPaymentsStatus: string;
  payoutsStatus: string;
  livemode: boolean;
};
type AdminData = {
  id: string;
  nonprofit: { id: string; name: string; slug: string } | null;
  payment: PaymentConnection | null;
  list: AuctionSummary[];
  state: {
    name: string;
    organization: string;
    items: unknown[];
    supporters: number;
    bidCount: number;
    total: number;
    goal: number;
    paused: boolean;
    ends: number;
  };
};

export default function AdminClient() {
  const [data, setData] = useState<AdminData | null>(null);
  const [payment, setPayment] = useState<PaymentConnection | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [now] = useState(() => Date.now());
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("auction");
    fetch("/api/auction" + (id ? `?id=${encodeURIComponent(id)}` : ""))
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load workspace.");
        const loaded = (await response.json()) as AdminData;
        setData(loaded);
        setPayment(loaded.payment);
        if (loaded.nonprofit) {
          const statusResponse = await fetch(
            `/api/stripe/connect?nonprofit=${encodeURIComponent(loaded.nonprofit.id)}`,
          );
          if (statusResponse.ok) {
            const statusData = (await statusResponse.json()) as {
              connection: PaymentConnection;
            };
            setPayment(statusData.connection);
          }
        }
      })
      .catch(() => toast.error("Unable to load your workspace."));
  }, []);
  if (!data)
    return (
      <div className="p-10 text-muted-foreground">
        Loading your admin workspace…
      </div>
    );
  const a = data.state;
  const connectPayments = async () => {
    if (!data.nonprofit || connecting) return;
    setConnecting(true);
    try {
      const response = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nonprofitId: data.nonprofit.id,
          auctionId: data.id,
        }),
      });
      const result = (await response.json()) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !result.url)
        throw new Error(result.error || "Unable to start Stripe setup.");
      window.location.assign(result.url);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to start Stripe setup.",
      );
      setConnecting(false);
    }
  };
  return (
    <AdminDashboard
      auction={{
        name: a.name,
        organization: a.organization,
        items: a.items.length,
        bidders: a.supporters,
        bids: a.bidCount,
        total: money(a.total),
        goal: money(a.goal),
        progress: Math.min(100, Math.round((a.total / a.goal) * 100)),
        paused: a.paused,
        ends:
          a.ends > now
            ? `${Math.ceil((a.ends - now) / 86400000)} days remaining`
            : "Auction closed",
      }}
      previousAuctions={(data.list || [])
        .filter((auction) => auction.id !== data.id)
        .map((auction) => ({
          ...auction,
          total: money(auction.total),
          endsLabel: new Date(auction.ends).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
        }))}
      nonprofit={data.nonprofit}
      payment={payment}
      connectingPayments={connecting}
      onManageItems={() => window.location.assign("/?view=Manage%20items")}
      onManagePage={() => window.location.assign("/?view=Nonprofit%20page")}
      onCreateAuction={() => window.location.assign("/onboarding")}
      onSettlement={() =>
        window.location.assign(
          `/admin/settlement?auction=${encodeURIComponent(data.id)}`,
        )
      }
      onSupporters={() =>
        window.location.assign(
          `/admin/supporters?organization=${encodeURIComponent(data.nonprofit?.id || "")}`,
        )
      }
      onMessages={() =>
        window.location.assign(
          `/messages?organization=${encodeURIComponent(data.nonprofit?.id || "")}&auction=${encodeURIComponent(data.id)}`,
        )
      }
      onEmailSettings={() =>
        window.location.assign(
          `/admin/settings/email-receipts?organization=${encodeURIComponent(data.nonprofit?.id || "")}`,
        )
      }
      onDirectOffers={() =>
        window.location.assign(
          `/admin/direct-offers?organization=${encodeURIComponent(data.nonprofit?.id || "")}`,
        )
      }
      onTickets={() =>
        window.location.assign(
          `/admin/tickets?organization=${encodeURIComponent(data.nonprofit?.id || "")}&auction=${encodeURIComponent(data.id)}`,
        )
      }
      onSponsors={() =>
        window.location.assign(
          `/admin/sponsors?organization=${encodeURIComponent(data.nonprofit?.id || "")}&auction=${encodeURIComponent(data.id)}`,
        )
      }
      onLive={() =>
        window.location.assign(
          `/admin/live?auction=${encodeURIComponent(data.id)}`,
        )
      }
      onHomepage={() =>
        window.location.assign(
          `/homepage?nonprofit=${encodeURIComponent(data.nonprofit?.id || "")}`,
        )
      }
      onConnectPayments={connectPayments}
      onOpenAuction={(auctionId) =>
        window.location.assign(
          `/admin?auction=${encodeURIComponent(auctionId)}`,
        )
      }
      onViewAuction={(auctionId) =>
        window.open(
          `/?auction=${encodeURIComponent(auctionId)}`,
          "_blank",
          "noopener,noreferrer",
        )
      }
    />
  );
}

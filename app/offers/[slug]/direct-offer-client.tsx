"use client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Heart,
  LoaderCircle,
  MapPin,
  Minus,
  Plane,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast, Toaster } from "sonner";
import Link from "next/link";
type Offer = {
  id: string;
  slug: string;
  title: string;
  fundraisingMessage: string;
  additionalInformation: string;
  heroImageUrl: string;
  primaryColor: string;
  accentColor: string;
  fundraisingAmountCents: number;
  platformFeeCents: number;
  taxCents: number;
  unitPriceCents: number;
  availableQuantity: number;
  expiresAt: string | null;
  termsVersion: string;
  organization: { display_name: string; headline: string; mission: string };
  package: {
    title: string;
    destination: string;
    region: string;
    description: string;
    included: string;
    notIncluded: string;
    stayLength: string;
    occupancy: string;
    roomType: string;
    expirationDate: string | null;
    bookingLeadTimeDays: number | null;
    cancellationTerms: string;
    refundTerms: string;
    restrictions: string;
    galleryUrls: string[];
  };
};
const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value / 100,
  );
export default function DirectOfferClient({ slug }: { slug: string }) {
  const [offer, setOffer] = useState<Offer | null>(null),
    [error, setError] = useState(""),
    [checkout, setCheckout] = useState(false),
    [busy, setBusy] = useState(false),
    [quantity, setQuantity] = useState(1),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [accepted, setAccepted] = useState(false);
  useEffect(() => {
    fetch(`/api/direct-offers/${encodeURIComponent(slug)}`)
      .then(async (response) => {
        const body = (await response.json()) as {
          offer?: Offer;
          error?: string;
        };
        if (!response.ok || !body.offer)
          throw Error(body.error || "Offer unavailable.");
        setOffer(body.offer);
      })
      .catch((reason) => setError(reason.message));
  }, [slug]);
  const purchase = async () => {
    if (!offer) return;
    setBusy(true);
    try {
      const response = await fetch("/api/direct-offers/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          offerId: offer.id,
          name,
          email,
          quantity,
          termsVersion: offer.termsVersion,
          termsAccepted: accepted,
        }),
      });
      const body = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !body.url)
        throw Error(body.error || "Unable to open checkout.");
      window.location.assign(body.url);
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Unable to open checkout.",
      );
      setBusy(false);
    }
  };
  if (error)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f8f6] p-6">
        <div className="max-w-md rounded-2xl border bg-white p-8 text-center">
          <Plane className="mx-auto text-[#175b47]" />
          <h1 className="mt-4 text-2xl font-semibold">Offer unavailable</h1>
          <p className="mt-2 text-muted-foreground">{error}</p>
          <Link
            href="/"
            className="mt-5 inline-block font-semibold text-[#175b47]"
          >
            Return to Gather
          </Link>
        </div>
      </main>
    );
  if (!offer)
    return (
      <main className="grid min-h-screen place-items-center">
        <LoaderCircle className="animate-spin text-[#175b47]" />
      </main>
    );
  const pkg = offer.package,
    soldOut = offer.availableQuantity < 1;
  return (
    <main className="min-h-screen bg-[#f7faf8]">
      <Toaster richColors />
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-2xl font-semibold text-[#175b47]">
            gather<span className="text-[#78a68b]">.</span>
          </Link>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Give Holidays travel partner
          </span>
        </div>
      </header>
      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:py-14">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#e8f2ed] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[#175b47]">
            <Heart size={14} />
            Travel that gives back
          </span>
          <p
            className="mt-7 text-sm font-semibold"
            style={{ color: offer.primaryColor }}
          >
            {offer.organization.display_name}
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {offer.title}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
            {offer.fundraisingMessage}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Button
              className="h-12 px-6"
              style={{ backgroundColor: offer.primaryColor }}
              disabled={soldOut}
              onClick={() => setCheckout(true)}
            >
              {soldOut
                ? "Sold out"
                : `Purchase for ${money(offer.unitPriceCents)}`}
              <ArrowRight size={17} />
            </Button>
            <span className="text-sm text-muted-foreground">
              {offer.availableQuantity} available
            </span>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            This is a travel purchase supporting{" "}
            {offer.organization.display_name}. The full purchase price is not
            represented as a charitable donation.
          </p>
        </div>
        <div className="relative overflow-hidden rounded-[2rem] bg-[#dceae3] shadow-xl">
          <img
            src={offer.heroImageUrl}
            alt={pkg.destination}
            className="aspect-[1.25] w-full object-cover"
          />
          <div className="absolute inset-x-4 bottom-4 grid grid-cols-3 gap-2 rounded-2xl bg-white/95 p-4 shadow-lg backdrop-blur">
            <Mini
              icon={<MapPin />}
              label="Destination"
              value={pkg.destination}
            />
            <Mini icon={<CalendarDays />} label="Stay" value={pkg.stayLength} />
            <Mini icon={<Users />} label="Guests" value={pkg.occupancy} />
          </div>
        </div>
      </section>
      <section className="border-y bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 lg:grid-cols-[1.3fr_.7fr]">
          <div>
            <p className="eyebrow text-muted-foreground">THE EXPERIENCE</p>
            <h2 className="mt-2 text-3xl font-semibold">{pkg.title}</h2>
            <p className="mt-5 whitespace-pre-wrap leading-7 text-muted-foreground">
              {pkg.description}
            </p>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <Info title="What’s included" text={pkg.included} />
              <Info title="Important exclusions" text={pkg.notIncluded} />
              <Info title="Booking conditions" text={pkg.restrictions} />
              <Info
                title="Cancellation & refunds"
                text={[pkg.cancellationTerms, pkg.refundTerms]
                  .filter(Boolean)
                  .join("\n")}
              />
            </div>
          </div>
          <aside className="rounded-2xl bg-[#f2f7f4] p-6">
            <Plane className="text-[#175b47]" />
            <h3 className="mt-4 text-xl font-semibold">
              Give Holidays concierge care
            </h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              After verified payment, Give Holidays creates your guest record
              and proactively contacts you. No voucher submission is required to
              begin.
            </p>
            <p className="mt-5 text-sm font-semibold">
              The people who show up for others deserve a travel partner who
              shows up for them.
            </p>
            <dl className="mt-6 space-y-3 text-sm">
              <Line label="Package price" value={money(offer.unitPriceCents)} />
              <Line
                label="Fundraising support included"
                value={money(offer.fundraisingAmountCents)}
              />
              {offer.expiresAt && (
                <Line
                  label="Offer ends"
                  value={new Date(offer.expiresAt).toLocaleDateString()}
                />
              )}
            </dl>
          </aside>
        </div>
      </section>
      {offer.additionalInformation && (
        <section className="mx-auto max-w-4xl px-5 py-12 text-center">
          <h2 className="text-2xl font-semibold">Why this matters</h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            {offer.additionalInformation}
          </p>
        </section>
      )}
      {checkout && (
        <div className="fixed inset-0 z-50 overflow-auto bg-black/50 p-4">
          <div className="mx-auto mt-8 max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex justify-between gap-4">
              <div>
                <p className="eyebrow text-muted-foreground">SECURE PURCHASE</p>
                <h2 className="mt-2 text-2xl font-semibold">
                  Complete your details
                </h2>
              </div>
              <button
                onClick={() => setCheckout(false)}
                className="min-h-11 px-2"
              >
                Close
              </button>
            </div>
            <div className="mt-5 grid gap-4">
              <label className="text-sm font-medium">
                Purchaser name
                <Input
                  className="mt-2"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                />
              </label>
              <label className="text-sm font-medium">
                Email address
                <Input
                  className="mt-2"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                />
              </label>
              <div>
                <span className="text-sm font-medium">Quantity</span>
                <div className="mt-2 flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Minus size={15} />
                  </Button>
                  <strong>{quantity}</strong>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setQuantity(
                        Math.min(offer.availableQuantity, quantity + 1),
                      )
                    }
                  >
                    <Plus size={15} />
                  </Button>
                  <span className="ml-auto font-semibold">
                    {money(offer.unitPriceCents * quantity)}
                  </span>
                </div>
              </div>
              <div className="rounded-xl bg-[#f5f8f6] p-4 text-sm">
                <Line
                  label="Travel purchase"
                  value={money(offer.unitPriceCents * quantity)}
                />
                <Line
                  label="Gather direct-offer fee"
                  value={
                    offer.platformFeeCents
                      ? money(offer.platformFeeCents * quantity)
                      : "$0.00"
                  }
                />
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  Stripe processing fees are accounted for separately and
                  deducted from nonprofit proceeds. No auction commission is
                  applied.
                </p>
              </div>
              <label className="flex items-start gap-3 text-sm leading-6">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                />
                <span>
                  I acknowledge the package restrictions, redemption,
                  cancellation, and refund terms shown on this page.
                </span>
              </label>
              <Button
                className="h-12"
                disabled={
                  busy ||
                  !accepted ||
                  name.trim().length < 2 ||
                  !email.includes("@")
                }
                onClick={purchase}
              >
                {busy ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <ShieldCheck size={17} />
                )}
                Continue to secure payment
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
function Mini({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 text-center">
      {
        <span className="mx-auto grid size-7 place-items-center text-[#175b47] [&>svg]:size-4">
          {icon}
        </span>
      }
      <span className="mt-1 block text-[10px] text-muted-foreground">
        {label}
      </span>
      <strong className="block truncate text-xs">
        {value || "See details"}
      </strong>
    </div>
  );
}
function Info({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border p-5">
      <h3 className="flex items-center gap-2 font-semibold">
        <Check size={16} className="text-[#2f7d5b]" />
        {title}
      </h3>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
        {text || "See complete package terms before purchase."}
      </p>
    </div>
  );
}
function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b pb-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}

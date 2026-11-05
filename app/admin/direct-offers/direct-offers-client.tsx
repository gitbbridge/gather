"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Eye,
  Heart,
  LoaderCircle,
  MapPin,
  Pause,
  Plus,
  Save,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast, Toaster } from "sonner";
import Link from "next/link";
type Package = {
  id: string;
  title: string;
  destination: string;
  region: string;
  heroImageUrl: string;
  fullDescription: string;
  included: string;
  notIncluded: string;
  stayLength: string;
  occupancy: string;
  roomType: string;
  expirationDate: string;
  bookingLeadTimeDays: number;
  cancellationTerms: string;
  refundTerms: string;
  restrictions: string;
  packageCostCents: number;
  packagesAvailable: number;
};
type Offer = {
  id: string;
  slug: string;
  title: string;
  status: string;
  travel_package_id: string;
  fundraising_message: string;
  additional_information: string;
  fundraising_amount_cents: number;
  package_cost_cents: number;
  unit_price_cents: number;
  available_quantity: number;
  quantity_sold: number;
  expires_at: string | null;
  primary_color: string;
  accent_color: string;
  auction_id: string | null;
  travel_packages: {
    destination: string;
    title: string;
    hero_image_url: string;
  };
};
type Payload = {
  organization: { id: string; name: string; accentColor: string };
  packages: Package[];
  offers: Offer[];
  auctions: { id: string; name: string }[];
  error?: string;
};
const money = (c: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    c / 100,
  );
const blank = {
  id: "",
  travelPackageId: "",
  title: "",
  fundraisingMessage: "",
  additionalInformation: "",
  fundraisingAmount: "500",
  availableQuantity: 1,
  expiresAt: "",
  primaryColor: "#175b47",
  accentColor: "#78a68b",
  auctionId: "",
  isPublic: true,
};
export default function DirectOffersClient({
  organizationId,
}: {
  organizationId: string;
}) {
  const [data, setData] = useState<Payload | null>(null),
    [step, setStep] = useState(0),
    [draft, setDraft] = useState(blank),
    [busy, setBusy] = useState(false),
    [building, setBuilding] = useState(false);
  const load = useCallback(async () => {
    if (!organizationId) return;
    const response = await fetch(
      `/api/direct-offers?organization=${organizationId}`,
    );
    const value = (await response.json()) as Payload;
    if (!response.ok) throw Error(value.error || "Unable to load offers.");
    setData(value);
  }, [organizationId]);
  useEffect(() => {
    // Loading the remote organizer workspace is the purpose of this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((error) => toast.error(error.message));
  }, [load]);
  const pkg = useMemo(
    () => data?.packages.find((item) => item.id === draft.travelPackageId),
    [data, draft.travelPackageId],
  );
  const fundraising = Math.round((Number(draft.fundraisingAmount) || 0) * 100),
    price = (pkg?.packageCostCents || 0) + fundraising;
  const save = async (
    action: "save" | "publish" | "pause" | "archive" | "duplicate",
    source?: Offer,
  ) => {
    setBusy(true);
    try {
      const response = await fetch("/api/direct-offers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          source
            ? {
                id: source.id,
                organizationId,
                travelPackageId: source.travel_package_id,
                title: source.title,
                fundraisingMessage: source.fundraising_message,
                additionalInformation: source.additional_information,
                fundraisingAmountCents: source.fundraising_amount_cents,
                availableQuantity: source.available_quantity,
                expiresAt: source.expires_at,
                primaryColor: source.primary_color,
                accentColor: source.accent_color,
                auctionId: source.auction_id,
                isPublic: true,
                action,
              }
            : {
                id: draft.id || undefined,
                organizationId,
                travelPackageId: draft.travelPackageId,
                title: draft.title,
                fundraisingMessage: draft.fundraisingMessage,
                additionalInformation: draft.additionalInformation,
                fundraisingAmountCents: fundraising,
                availableQuantity: draft.availableQuantity,
                expiresAt: draft.expiresAt
                  ? new Date(draft.expiresAt).toISOString()
                  : null,
                primaryColor: draft.primaryColor,
                accentColor: draft.accentColor,
                auctionId: draft.auctionId || null,
                isPublic: draft.isPublic,
                action,
              },
        ),
      });
      const value = (await response.json()) as {
        offer?: Offer;
        error?: string;
      };
      if (!response.ok) throw Error(value.error || "Unable to save offer.");
      toast.success(
        action === "publish"
          ? "Offer published"
          : action === "duplicate"
            ? "Offer duplicated"
            : "Offer saved",
      );
      setBuilding(false);
      setDraft(blank);
      setStep(0);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save offer.",
      );
    } finally {
      setBusy(false);
    }
  };
  const edit = (offer: Offer) => {
    setDraft({
      id: offer.id,
      travelPackageId: offer.travel_package_id,
      title: offer.title,
      fundraisingMessage: offer.fundraising_message,
      additionalInformation: offer.additional_information,
      fundraisingAmount: String(offer.fundraising_amount_cents / 100),
      availableQuantity: offer.available_quantity,
      expiresAt: offer.expires_at ? offer.expires_at.slice(0, 16) : "",
      primaryColor: offer.primary_color,
      accentColor: offer.accent_color,
      auctionId: offer.auction_id || "",
      isPublic: true,
    });
    setBuilding(true);
    setStep(1);
  };
  if (!organizationId)
    return (
      <Empty text="Open Direct Fundraising Offers from an organization dashboard." />
    );
  if (!data) return <Empty text="Loading Give Holidays offers…" loading />;
  return (
    <main className="min-h-screen bg-[#f5f8f6]">
      <Toaster richColors />
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <a
            href="/admin"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <ArrowLeft size={15} />
            Dashboard
          </a>
          <Link href="/" className="text-2xl font-semibold text-[#175b47]">
            gather<span className="text-[#78a68b]">.</span>
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-muted-foreground">GIVE HOLIDAYS</p>
            <h1 className="mt-2 text-3xl font-semibold">
              Direct Fundraising Offers
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Sell a curated travel experience at a fixed price and raise funds
              without creating an auction.
            </p>
          </div>
          <Button
            onClick={() => {
              setBuilding(true);
              setDraft(blank);
              setStep(0);
            }}
          >
            <Plus size={16} />
            Create offer
          </Button>
        </div>
        {building ? (
          <div className="mt-7">
            <div className="mb-6 grid grid-cols-4 overflow-hidden rounded-xl border bg-white">
              {[
                "Select experience",
                "Set fundraising",
                "Customize",
                "Review & publish",
              ].map((label, index) => (
                <div
                  key={label}
                  className={`p-3 text-center text-xs font-semibold ${index === step ? "bg-[#175b47] text-white" : index < step ? "bg-[#e9f2ed] text-[#175b47]" : "text-muted-foreground"}`}
                >
                  {index + 1}. {label}
                </div>
              ))}
            </div>
            <section className="rounded-2xl border bg-white p-5 sm:p-7">
              {step === 0 && (
                <div>
                  <h2 className="text-2xl font-semibold">
                    Choose an eligible experience
                  </h2>
                  <p className="mt-2 text-muted-foreground">
                    Package pricing and protected travel terms remain controlled
                    by Give Holidays.
                  </p>
                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {data.packages.map((item) => (
                      <button
                        key={item.id}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            travelPackageId: item.id,
                            title: draft.title || item.title,
                            availableQuantity: Math.min(
                              draft.availableQuantity,
                              item.packagesAvailable,
                            ),
                          })
                        }
                        className={`overflow-hidden rounded-xl border text-left ${draft.travelPackageId === item.id ? "border-[#175b47] ring-2 ring-[#175b47]" : "hover:border-[#91ae9d]"}`}
                      >
                        <img
                          src={item.heroImageUrl}
                          alt=""
                          className="aspect-[1.7] w-full object-cover"
                        />
                        <div className="p-4">
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin size={12} />
                            {item.destination}
                          </p>
                          <h3 className="mt-1 font-semibold">{item.title}</h3>
                          <div className="mt-3 flex justify-between text-xs">
                            <span>
                              {item.stayLength} · {item.occupancy}
                            </span>
                            <strong>
                              {money(item.packageCostCents)} package cost
                            </strong>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {item.packagesAvailable} authorized
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                  {!data.packages.length && (
                    <div className="mt-6 rounded-xl bg-amber-50 p-5 text-sm text-amber-900">
                      No packages are approved for direct offers yet. A Give
                      Holidays admin must enable eligibility in the master
                      catalog.
                    </div>
                  )}
                </div>
              )}
              {step === 1 && pkg && (
                <div className="grid gap-7 lg:grid-cols-[1fr_.8fr]">
                  <div>
                    <h2 className="text-2xl font-semibold">
                      Set your fundraising amount
                    </h2>
                    <p className="mt-2 text-muted-foreground">
                      Choose the amount your nonprofit should raise from each
                      purchase.
                    </p>
                    <label className="mt-6 block text-sm font-medium">
                      Fundraising amount per purchase
                      <div className="mt-2 flex rounded-md border">
                        <span className="border-r bg-muted px-3 py-2">$</span>
                        <Input
                          className="border-0 shadow-none"
                          type="number"
                          min="1"
                          value={draft.fundraisingAmount}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              fundraisingAmount: event.target.value,
                            })
                          }
                        />
                      </div>
                    </label>
                    <label className="mt-5 block text-sm font-medium">
                      Available purchases
                      <Input
                        className="mt-2"
                        type="number"
                        min="1"
                        max={pkg.packagesAvailable}
                        value={draft.availableQuantity}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            availableQuantity: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="rounded-xl bg-[#f3f7f5] p-5">
                    <h3 className="font-semibold">
                      Expected outcome per purchase
                    </h3>
                    <Rows
                      values={[
                        [
                          "Give Holidays package cost",
                          money(pkg.packageCostCents),
                        ],
                        ["Nonprofit fundraising amount", money(fundraising)],
                        ["Gather direct-offer fee", "$0.00"],
                        ["Donor purchase price", money(price)],
                        ["Expected nonprofit proceeds", money(fundraising)],
                      ]}
                    />
                    <p className="mt-4 text-xs leading-5 text-muted-foreground">
                      Stripe processing is calculated from the actual
                      transaction and deducted separately from nonprofit
                      proceeds.
                    </p>
                  </div>
                </div>
              )}
              {step === 2 && pkg && (
                <div>
                  <h2 className="text-2xl font-semibold">
                    Customize the offer
                  </h2>
                  <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    <label className="text-sm font-medium sm:col-span-2">
                      Offer title
                      <Input
                        className="mt-2"
                        value={draft.title}
                        onChange={(event) =>
                          setDraft({ ...draft, title: event.target.value })
                        }
                      />
                    </label>
                    <label className="text-sm font-medium sm:col-span-2">
                      Fundraising message
                      <Textarea
                        className="mt-2 min-h-28"
                        value={draft.fundraisingMessage}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            fundraisingMessage: event.target.value,
                          })
                        }
                        placeholder="Tell supporters what this purchase makes possible."
                      />
                    </label>
                    <label className="text-sm font-medium sm:col-span-2">
                      Additional campaign information
                      <Textarea
                        className="mt-2"
                        value={draft.additionalInformation}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            additionalInformation: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Offer expiration
                      <Input
                        className="mt-2"
                        type="datetime-local"
                        value={draft.expiresAt}
                        onChange={(event) =>
                          setDraft({ ...draft, expiresAt: event.target.value })
                        }
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Link to an event (optional)
                      <select
                        className="mt-2 min-h-10 w-full rounded-md border bg-white px-3"
                        value={draft.auctionId}
                        onChange={(event) =>
                          setDraft({ ...draft, auctionId: event.target.value })
                        }
                      >
                        <option value="">Standalone offer</option>
                        {data.auctions.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-medium">
                      Primary color
                      <Input
                        className="mt-2 h-11"
                        type="color"
                        value={draft.primaryColor}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            primaryColor: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Accent color
                      <Input
                        className="mt-2 h-11"
                        type="color"
                        value={draft.accentColor}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            accentColor: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                </div>
              )}
              {step === 3 && pkg && (
                <div className="grid gap-7 lg:grid-cols-[1fr_.8fr]">
                  <div>
                    <p className="eyebrow text-muted-foreground">
                      FINAL REVIEW
                    </p>
                    <h2 className="mt-2 text-3xl font-semibold">
                      {draft.title}
                    </h2>
                    <p className="mt-4 leading-7 text-muted-foreground">
                      {draft.fundraisingMessage}
                    </p>
                    <img
                      src={pkg.heroImageUrl}
                      alt=""
                      className="mt-6 aspect-[1.8] w-full rounded-2xl object-cover"
                    />
                  </div>
                  <aside className="rounded-xl border p-5">
                    <h3 className="font-semibold">Publication checklist</h3>
                    <ul className="mt-4 space-y-3 text-sm">
                      {[
                        "Approved Give Holidays package",
                        "Protected terms locked",
                        "Fixed donor price disclosed",
                        "Direct-offer platform fee $0.00",
                        "Purchase quantity confirmed",
                        "Concierge fulfillment after verified payment",
                      ].map((item) => (
                        <li key={item} className="flex gap-2">
                          <Check
                            size={15}
                            className="mt-0.5 text-emerald-700"
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <Rows
                      values={[
                        ["Donor price", money(price)],
                        [
                          "Available purchases",
                          String(draft.availableQuantity),
                        ],
                        [
                          "Placement",
                          draft.auctionId ? "Event-linked" : "Standalone",
                        ],
                      ]}
                    />
                    <Button
                      className="mt-6 w-full"
                      disabled={busy}
                      onClick={() => save("publish")}
                    >
                      {busy ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <Share2 size={16} />
                      )}
                      Approve & publish
                    </Button>
                    <Button
                      variant="outline"
                      className="mt-2 w-full"
                      disabled={busy}
                      onClick={() => save("save")}
                    >
                      <Save size={16} />
                      Save draft
                    </Button>
                  </aside>
                </div>
              )}
              <div className="mt-7 flex justify-between border-t pt-5">
                <Button
                  variant="outline"
                  onClick={() =>
                    step ? setStep(step - 1) : setBuilding(false)
                  }
                >
                  Back
                </Button>
                {step < 3 && (
                  <Button
                    disabled={
                      (step === 0 && !pkg) ||
                      (step === 1 && fundraising < 100) ||
                      (step === 2 &&
                        (!draft.title.trim() ||
                          !draft.fundraisingMessage.trim()))
                    }
                    onClick={() => setStep(step + 1)}
                  >
                    Continue
                    <ArrowRight size={15} />
                  </Button>
                )}
              </div>
            </section>
          </div>
        ) : (
          <section className="mt-7 overflow-hidden rounded-2xl border bg-white">
            <div className="border-b p-5">
              <h2 className="font-semibold">Your direct offers</h2>
            </div>
            {data.offers.length ? (
              <div className="divide-y">
                {data.offers.map((offer) => (
                  <article
                    key={offer.id}
                    className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{offer.title}</h3>
                        <span className="rounded-full bg-[#edf4f0] px-2 py-1 text-[10px] font-semibold uppercase text-[#175b47]">
                          {offer.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {offer.travel_packages?.destination} ·{" "}
                        {money(offer.unit_price_cents)} · {offer.quantity_sold}/
                        {offer.available_quantity} sold
                      </p>
                      <p className="mt-2 text-sm font-medium text-emerald-800">
                        {money(
                          offer.fundraising_amount_cents * offer.quantity_sold,
                        )}{" "}
                        fundraising proceeds before processing
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {offer.status === "active" && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={`/offers/${offer.slug}`} target="_blank">
                            <Eye size={14} />
                            View
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          navigator.clipboard
                            .writeText(
                              `${location.origin}/offers/${offer.slug}`,
                            )
                            .then(() => toast.success("Offer link copied"))
                        }
                      >
                        <Copy size={14} />
                        Copy link
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => edit(offer)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => save("duplicate", offer)}
                      >
                        <Copy size={14} />
                        Duplicate
                      </Button>
                      {offer.status === "active" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => save("pause", offer)}
                        >
                          <Pause size={14} />
                          Pause
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center">
                <Heart className="mx-auto text-[#175b47]" />
                <h3 className="mt-4 font-semibold">
                  Create your first travel fundraiser
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  No auction or scheduled event is required.
                </p>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
function Rows({ values }: { values: [string, string][] }) {
  return (
    <dl className="mt-5 space-y-3 text-sm">
      {values.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3 border-b pb-2">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
function Empty({ text, loading }: { text: string; loading?: boolean }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f8f6]">
      <div className="rounded-xl border bg-white p-8 text-muted-foreground">
        {loading && <LoaderCircle className="mb-3 animate-spin" />}
        {text}
      </div>
    </main>
  );
}

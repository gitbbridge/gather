import { z } from "zod";
import { getAppUser } from "@/lib/auth";
import { directOfferPricing, directOfferSlug } from "@/lib/direct-offers";
import { managedOrganization } from "@/lib/organizer-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const offerInput = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  travelPackageId: z.string().uuid(),
  auctionId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(2).max(160),
  fundraisingMessage: z.string().trim().max(3000),
  additionalInformation: z.string().trim().max(3000).default(""),
  heroImageUrl: z.string().url().or(z.literal("")).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fundraisingAmountCents: z.number().int().min(100).max(100_000_000),
  availableQuantity: z.number().int().min(1).max(1000),
  expiresAt: z.string().datetime().nullable().optional(),
  isPublic: z.boolean().default(true),
  action: z
    .enum(["save", "publish", "pause", "archive", "duplicate"])
    .default("save"),
});
export async function GET(request: Request) {
  const user = await getAppUser();
  if (!user)
    return Response.json({ error: "Sign in to continue." }, { status: 401 });
  const organizationId =
    new URL(request.url).searchParams.get("organization") || "";
  const access = await managedOrganization(organizationId);
  if (!access)
    return Response.json({ error: "Access denied." }, { status: 403 });
  const client = createSupabaseAdminClient();
  const [
    { data: packages, error: packageError },
    { data: offers, error: offerError },
    { data: auctions },
  ] = await Promise.all([
    client
      .from("travel_packages")
      .select("*")
      .eq("direct_offer_eligible", true)
      .eq("is_active", true)
      .eq("status", "active")
      .order("destination"),
    client
      .from("direct_offers")
      .select(
        "*,travel_packages(destination,title,hero_image_url,stay_length,occupancy)",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    client
      .from("auctions")
      .select("id,name,status")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
  ]);
  if (packageError || offerError)
    return Response.json(
      {
        error: "Apply the Direct Fundraising Offers migration, then try again.",
      },
      { status: 500 },
    );
  return Response.json(
    {
      organization: {
        id: access.nonprofit.id,
        name: access.nonprofit.name,
        slug: access.nonprofit.slug,
        accentColor: access.nonprofit.accent,
      },
      packages: (packages || []).map((row) => ({
        id: row.id,
        title: row.title,
        destination: row.destination,
        region: row.region,
        heroImageUrl: row.hero_image_url || row.image_url || "",
        galleryUrls: row.gallery_urls || [],
        fullDescription: row.full_description || row.summary,
        included: row.included,
        notIncluded: row.not_included,
        stayLength: row.stay_length,
        occupancy: row.occupancy,
        roomType: row.room_type,
        expirationDate: row.expiration_date,
        bookingLeadTimeDays: row.booking_lead_time_days,
        cancellationTerms: row.cancellation_terms,
        refundTerms: row.refund_terms,
        restrictions: row.terms?.restrictions || "",
        packageCostCents: row.wholesale_cost_cents,
        packagesAvailable: Math.min(
          row.inventory_total -
            row.inventory_sold -
            (row.inventory_reserved || 0),
          row.direct_offer_authorized_quantity,
        ),
      })),
      offers: offers || [],
      auctions: auctions || [],
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return Response.json({ error: "Invalid origin." }, { status: 403 });
  const user = await getAppUser();
  if (!user)
    return Response.json({ error: "Sign in to continue." }, { status: 401 });
  const parsed = offerInput.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: "Review the offer details and try again." },
      { status: 400 },
    );
  const input = parsed.data,
    access = await managedOrganization(input.organizationId);
  if (!access)
    return Response.json({ error: "Access denied." }, { status: 403 });
  const client = createSupabaseAdminClient();
  if (input.action === "duplicate" && input.id) {
    const { data: source } = await client
      .from("direct_offers")
      .select("*")
      .eq("id", input.id)
      .eq("organization_id", input.organizationId)
      .single();
    if (!source)
      return Response.json({ error: "Offer not found." }, { status: 404 });
    const { data, error } = await client
      .from("direct_offers")
      .insert({
        ...source,
        id: undefined,
        slug: `${directOfferSlug(source.title)}-${crypto.randomUUID().slice(0, 6)}`,
        title: `${source.title} — Copy`,
        status: "draft",
        quantity_reserved: 0,
        quantity_sold: 0,
        published_at: null,
        created_by: user.userId,
        created_at: undefined,
        updated_at: undefined,
      })
      .select("*")
      .single();
    return error
      ? Response.json({ error: "Unable to duplicate offer." }, { status: 500 })
      : Response.json({ offer: data });
  }
  if (input.id && ["pause", "archive"].includes(input.action)) {
    const { data, error } = await client
      .from("direct_offers")
      .update({
        status: input.action === "pause" ? "paused" : "archived",
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .eq("organization_id", input.organizationId)
      .select("*")
      .single();
    return error
      ? Response.json({ error: "Unable to update offer." }, { status: 500 })
      : Response.json({ offer: data });
  }
  const { data: pkg, error: packageError } = await client
    .from("travel_packages")
    .select("*")
    .eq("id", input.travelPackageId)
    .eq("direct_offer_eligible", true)
    .eq("is_active", true)
    .eq("status", "active")
    .single();
  if (packageError || !pkg)
    return Response.json(
      { error: "Choose an eligible Give Holidays package." },
      { status: 409 },
    );
  const available = Math.min(
    Number(pkg.inventory_total) -
      Number(pkg.inventory_sold) -
      Number(pkg.inventory_reserved || 0),
    Number(pkg.direct_offer_authorized_quantity),
  );
  if (input.availableQuantity > available)
    return Response.json(
      {
        error: `Only ${available} package${available === 1 ? " is" : "s are"} authorized for direct offers.`,
      },
      { status: 409 },
    );
  if (input.auctionId) {
    const { data: auction } = await client
      .from("auctions")
      .select("id")
      .eq("id", input.auctionId)
      .eq("organization_id", input.organizationId)
      .maybeSingle();
    if (!auction)
      return Response.json(
        { error: "The selected event does not belong to this organization." },
        { status: 403 },
      );
  }
  const pricing = directOfferPricing(
    Number(pkg.wholesale_cost_cents),
    input.fundraisingAmountCents,
    0,
    0,
  );
  const snapshot = {
    title: pkg.title,
    destination: pkg.destination,
    region: pkg.region,
    heroImageUrl: pkg.hero_image_url || pkg.image_url || "",
    galleryUrls: pkg.gallery_urls || [],
    description: pkg.full_description || pkg.summary,
    included: pkg.included,
    notIncluded: pkg.not_included,
    stayLength: pkg.stay_length,
    occupancy: pkg.occupancy,
    roomType: pkg.room_type,
    expirationDate: pkg.expiration_date,
    bookingLeadTimeDays: pkg.booking_lead_time_days,
    cancellationTerms: pkg.cancellation_terms,
    refundTerms: pkg.refund_terms,
    restrictions: pkg.terms?.restrictions || "",
    redemptionInstructions: pkg.redemption_instructions,
  };
  const record = {
    organization_id: input.organizationId,
    travel_package_id: pkg.id,
    auction_id: input.auctionId || null,
    created_by: user.userId,
    title: input.title,
    fundraising_message: input.fundraisingMessage,
    additional_information: input.additionalInformation,
    hero_image_url: input.heroImageUrl || snapshot.heroImageUrl,
    primary_color: input.primaryColor,
    accent_color: input.accentColor,
    ...Object.fromEntries(
      Object.entries(pricing)
        .filter(([key]) => key !== "expectedNonprofitProceedsCents")
        .map(([key, value]) => [
          key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`),
          value,
        ]),
    ),
    package_snapshot: snapshot,
    available_quantity: input.availableQuantity,
    expires_at: input.expiresAt || null,
    is_public: input.isPublic,
    status: input.action === "publish" ? "active" : "draft",
    published_at: input.action === "publish" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  let result;
  if (input.id) {
    const existing = await client
      .from("direct_offers")
      .select("quantity_sold")
      .eq("id", input.id)
      .eq("organization_id", input.organizationId)
      .single();
    if (existing.error)
      return Response.json({ error: "Offer not found." }, { status: 404 });
    result = await client
      .from("direct_offers")
      .update(record)
      .eq("id", input.id)
      .eq("organization_id", input.organizationId)
      .select("*")
      .single();
  } else {
    result = await client
      .from("direct_offers")
      .insert({
        ...record,
        slug: `${directOfferSlug(input.title)}-${crypto.randomUUID().slice(0, 6)}`,
      })
      .select("*")
      .single();
  }
  if (result.error)
    return Response.json(
      { error: "Unable to save the offer." },
      { status: 500 },
    );
  return Response.json({ offer: result.data });
}

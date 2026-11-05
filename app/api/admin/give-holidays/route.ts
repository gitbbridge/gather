import { z } from "zod";
import { getAppUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const packageInput = z.object({
  id: z.string().uuid().optional(),
  providerCode: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/),
  destination: z.string().trim().min(2).max(100),
  region: z.string().trim().min(2).max(100),
  title: z.string().trim().min(2).max(140),
  category: z.string().trim().min(2).max(80),
  summary: z.string().trim().max(2000),
  imageUrl: z.union([z.string().url(), z.literal("")]),
  galleryUrls: z.array(z.string().url()).max(12),
  fullDescription: z.string().trim().max(10000),
  included: z.string().trim().max(5000),
  notIncluded: z.string().trim().max(5000),
  wholesaleCostCents: z.number().int().min(0).max(100_000_000),
  platformMarkupCents: z.number().int().min(0).max(100_000_000),
  fairMarketValueCents: z.number().int().min(0).max(100_000_000),
  suggestedStartingBidCents: z.number().int().min(0).max(100_000_000),
  buyNowPriceCents: z.number().int().min(0).max(100_000_000),
  minimumSaleFloorCents: z.number().int().min(0).max(100_000_000),
  inventoryTotal: z.number().int().min(0).max(10000),
  inventorySold: z.number().int().min(0).max(10000),
  stayLength: z.string().trim().max(100),
  occupancy: z.string().trim().max(100),
  roomType: z.string().trim().max(100),
  expirationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal("")),
  bookingLeadTimeDays: z.number().int().min(0).max(730),
  requiredTravelerDetails: z.array(z.string().trim().min(1).max(100)).max(20),
  cancellationTerms: z.string().trim().max(5000),
  refundTerms: z.string().trim().max(5000),
  redemptionInstructions: z.string().trim().max(5000),
  supplierName: z.string().trim().max(200),
  supplierReference: z.string().trim().max(200),
  internalNotes: z.string().trim().max(5000),
  status: z.enum(["draft", "active", "paused", "sold_out", "retired"]),
  isActive: z.boolean(),
  directOfferEligible: z.boolean().default(false),
  directOfferAuthorizedQuantity: z.number().int().min(0).max(10000).default(0),
  terms: z.object({
    nights: z.string().trim().max(80).optional(),
    guests: z.string().trim().max(80).optional(),
    validity: z.string().trim().max(200).optional(),
    blackoutDates: z.string().trim().max(500).optional(),
    inclusions: z.string().trim().max(2000).optional(),
    restrictions: z.string().trim().max(2000).optional(),
  }),
});

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

function slug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function publicPackage(row: Record<string, unknown>) {
  return {
    id: row.id,
    providerCode: row.provider_code,
    destination: row.destination,
    region: row.region,
    title: row.title,
    category: row.category || "Travel",
    summary: row.summary,
    imageUrl: row.image_url || "",
    galleryUrls: row.gallery_urls || [],
    fullDescription: row.full_description || "",
    included: row.included || "",
    notIncluded: row.not_included || "",
    wholesaleCostCents: row.wholesale_cost_cents,
    platformMarkupCents: row.platform_markup_cents,
    fairMarketValueCents: row.fair_market_value_cents,
    suggestedStartingBidCents: row.suggested_starting_bid_cents,
    buyNowPriceCents: row.buy_now_price_cents || 0,
    minimumSaleFloorCents: row.minimum_sale_floor_cents || 0,
    inventoryTotal: row.inventory_total ?? 1,
    inventorySold: row.inventory_sold || 0,
    stayLength: row.stay_length || "",
    occupancy: row.occupancy || "",
    roomType: row.room_type || "",
    expirationDate: row.expiration_date || "",
    bookingLeadTimeDays: row.booking_lead_time_days || 0,
    requiredTravelerDetails: row.required_traveler_details || [],
    cancellationTerms: row.cancellation_terms || "",
    refundTerms: row.refund_terms || "",
    redemptionInstructions: row.redemption_instructions || "",
    supplierName: row.supplier_name || "",
    supplierReference: row.supplier_reference || "",
    internalNotes: row.internal_notes || "",
    status: row.status,
    isActive: row.is_active,
    directOfferEligible: row.direct_offer_eligible || false,
    directOfferAuthorizedQuantity: row.direct_offer_authorized_quantity || 0,
    terms: row.terms || {},
  };
}

async function requirePlatformAdmin() {
  const user = await getAppUser();
  return isPlatformAdmin(user) ? user : null;
}

export async function GET() {
  try {
    if (!(await requirePlatformAdmin()))
      return json({ error: "Platform administrator access required." }, 403);
    const { data, error } = await createSupabaseAdminClient()
      .from("travel_packages")
      .select("*")
      .order("destination");
    if (error) throw error;
    return json({ packages: (data || []).map((row) => publicPackage(row)) });
  } catch (error) {
    console.error("Unable to load Give Holidays packages:", error);
    return json(
      {
        error:
          "Unable to load the travel catalog. Apply the latest Supabase migration and try again.",
      },
      500,
    );
  }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin)
      return json({ error: "Invalid request origin." }, 403);
    if (!(await requirePlatformAdmin()))
      return json({ error: "Platform administrator access required." }, 403);
    if (Number(request.headers.get("content-length") || 0) > 20_000)
      return json({ error: "Request too large." }, 413);
    const parsed = packageInput.safeParse(await request.json());
    if (!parsed.success)
      return json({ error: "Review the package details and try again." }, 400);
    const value = parsed.data;
    if (value.inventorySold > value.inventoryTotal)
      return json(
        { error: "Sold quantity cannot exceed total availability." },
        400,
      );
    if (
      value.isActive &&
      (value.status !== "active" ||
        value.wholesaleCostCents <= 0 ||
        value.fairMarketValueCents <= 0 ||
        value.inventorySold >= value.inventoryTotal)
    ) {
      return json(
        {
          error:
            "Active packages need cost, value, and at least one available package.",
        },
        400,
      );
    }
    const record = {
      provider_code: value.providerCode.toUpperCase(),
      slug: slug(value.destination),
      destination: value.destination,
      region: value.region,
      title: value.title,
      category: value.category,
      summary: value.summary,
      image_url: value.imageUrl || null,
      hero_image_url: value.imageUrl || null,
      gallery_urls: value.galleryUrls,
      card_description: value.summary,
      full_description: value.fullDescription,
      included: value.included,
      not_included: value.notIncluded,
      wholesale_cost_cents: value.wholesaleCostCents,
      platform_markup_cents: value.platformMarkupCents,
      fair_market_value_cents: value.fairMarketValueCents,
      suggested_starting_bid_cents: value.suggestedStartingBidCents,
      buy_now_price_cents: value.buyNowPriceCents || null,
      minimum_sale_floor_cents: value.minimumSaleFloorCents,
      inventory_total: value.inventoryTotal,
      inventory_sold: value.inventorySold,
      stay_length: value.stayLength,
      occupancy: value.occupancy,
      room_type: value.roomType,
      expiration_date: value.expirationDate || null,
      booking_lead_time_days: value.bookingLeadTimeDays || null,
      required_traveler_details: value.requiredTravelerDetails,
      cancellation_terms: value.cancellationTerms,
      refund_terms: value.refundTerms,
      redemption_instructions: value.redemptionInstructions,
      supplier_name: value.supplierName || null,
      supplier_reference: value.supplierReference || null,
      internal_notes: value.internalNotes || null,
      status: value.status,
      is_active: value.isActive,
      direct_offer_eligible: value.directOfferEligible,
      direct_offer_authorized_quantity: value.directOfferEligible
        ? value.directOfferAuthorizedQuantity
        : 0,
      terms: value.terms,
    };
    const client = createSupabaseAdminClient();
    const query = value.id
      ? client.from("travel_packages").update(record).eq("id", value.id)
      : client.from("travel_packages").insert(record);
    const { data, error } = await query.select("*").single();
    if (error) throw error;
    return json({ package: publicPackage(data) });
  } catch (error) {
    console.error("Unable to save Give Holidays package:", error);
    return json(
      {
        error:
          "Unable to save the package. Check that its code and destination are unique.",
      },
      500,
    );
  }
}

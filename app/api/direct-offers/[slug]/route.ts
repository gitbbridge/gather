import { createSupabaseAdminClient } from "@/lib/supabase/admin";
const first = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] || null : value || null;
export async function GET(
  _: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params,
    client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("direct_offers")
    .select(
      "id,organization_id,slug,title,fundraising_message,additional_information,hero_image_url,primary_color,accent_color,fundraising_amount_cents,platform_fee_cents,tax_cents,unit_price_cents,currency,package_snapshot,available_quantity,quantity_reserved,quantity_sold,expires_at,status,terms_version,organizations(display_name,slug,headline,mission,accent_color)",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (
    error ||
    !data ||
    data.status !== "active" ||
    (data.expires_at && new Date(data.expires_at) <= new Date())
  )
    return Response.json(
      { error: "This offer is not available." },
      { status: 404 },
    );
  return Response.json(
    {
      offer: {
        id: data.id,
        slug: data.slug,
        title: data.title,
        fundraisingMessage: data.fundraising_message,
        additionalInformation: data.additional_information,
        heroImageUrl: data.hero_image_url,
        primaryColor: data.primary_color,
        accentColor: data.accent_color,
        fundraisingAmountCents: data.fundraising_amount_cents,
        platformFeeCents: data.platform_fee_cents,
        taxCents: data.tax_cents,
        unitPriceCents: data.unit_price_cents,
        currency: data.currency,
        package: data.package_snapshot,
        availableQuantity: Math.max(
          0,
          data.available_quantity - data.quantity_reserved - data.quantity_sold,
        ),
        expiresAt: data.expires_at,
        status: data.status,
        termsVersion: data.terms_version,
        organization: first(data.organizations),
      },
    },
    { headers: { "cache-control": "public, max-age=30" } },
  );
}

import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sponsorRecognitionCopy } from "@/lib/sponsors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auctionId = new URL(request.url).searchParams.get("auction") || "";
  if (!z.string().uuid().safeParse(auctionId).success)
    return Response.json({ sponsors: [], itemSponsors: {}, feeSponsor: null });
  try {
    const client = createSupabaseAdminClient();
    const [{ data: sponsors, error }, { data: recognition }, { data: agreements }] = await Promise.all([
      client
        .from("event_sponsors")
        .select("id,display_order,sponsor_businesses(business_name,logo_url,website_url,description),sponsorship_tiers(name,display_rank,display_style,is_visible),auction_item_sponsors(auction_item_id,recognition_enabled)")
        .eq("auction_id", auctionId)
        .eq("status", "active")
        .eq("public_recognition_enabled", true)
        .order("display_order"),
      client.from("fee_sponsorship_recognition").select("show_sponsor_name,show_sponsor_logo,show_public_event_page").eq("auction_id", auctionId).maybeSingle(),
      client
        .from("fee_sponsorship_agreements")
        .select("id,coverage,maximum_cents,allocated_cents,status,event_sponsors(sponsor_businesses(business_name,logo_url))")
        .eq("auction_id", auctionId)
        .in("status", ["active", "exhausted"])
        .order("created_at", { ascending: false }),
    ]);
    if (error) throw error;
    const publicSponsors = (sponsors || []).flatMap((row) => {
      const business = Array.isArray(row.sponsor_businesses) ? row.sponsor_businesses[0] : row.sponsor_businesses;
      const tier = Array.isArray(row.sponsorship_tiers) ? row.sponsorship_tiers[0] : row.sponsorship_tiers;
      if (!business || !tier?.is_visible) return [];
      return [{ id: row.id, name: business.business_name, logoUrl: business.logo_url, websiteUrl: business.website_url, description: business.description, tierName: tier.name, tierRank: tier.display_rank, displayStyle: tier.display_style, displayOrder: row.display_order }];
    }).sort((a, b) => a.tierRank - b.tierRank || a.displayOrder - b.displayOrder);
    const itemSponsors: Record<string, { name: string; logoUrl: string | null }[]> = {};
    for (const row of sponsors || []) {
      const business = Array.isArray(row.sponsor_businesses) ? row.sponsor_businesses[0] : row.sponsor_businesses;
      if (!business) continue;
      for (const link of row.auction_item_sponsors || []) {
        if (!link.recognition_enabled) continue;
        itemSponsors[link.auction_item_id] = [...(itemSponsors[link.auction_item_id] || []), { name: business.business_name, logoUrl: business.logo_url }];
      }
    }
    const agreement = (agreements || []).find((row) => Number(row.maximum_cents) > Number(row.allocated_cents));
    let feeSponsor = null;
    if (agreement && recognition?.show_public_event_page) {
      const eventSponsor = Array.isArray(agreement.event_sponsors) ? agreement.event_sponsors[0] : agreement.event_sponsors;
      const business = Array.isArray(eventSponsor?.sponsor_businesses) ? eventSponsor.sponsor_businesses[0] : eventSponsor?.sponsor_businesses;
      if (business) feeSponsor = {
        name: recognition.show_sponsor_name ? business.business_name : "A generous event sponsor",
        logoUrl: recognition.show_sponsor_logo ? business.logo_url : null,
        copy: sponsorRecognitionCopy({ sponsorName: business.business_name, coverage: agreement.coverage, maximumCents: Number(agreement.maximum_cents), remainingCents: Number(agreement.maximum_cents) - Number(agreement.allocated_cents) }),
      };
    }
    return Response.json({ sponsors: publicSponsors, itemSponsors, feeSponsor }, { headers: { "cache-control": "public, max-age=60" } });
  } catch (error) {
    console.error("Unable to load public sponsors:", error);
    return Response.json({ sponsors: [], itemSponsors: {}, feeSponsor: null });
  }
}

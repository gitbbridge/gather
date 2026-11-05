import type { Auction } from '@/lib/auction';
import { createSupabaseAdminClient } from './admin';

type SyncAuctionInput = {
  auctionId: string;
  nonprofitId: string;
  ownerId: string;
  nonprofitSlug: string;
  auction: Auction;
};

const slug = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

export async function syncCreatedAuctionToSupabase(input: SyncAuctionInput) {
  const client = createSupabaseAdminClient();
  const { error: organizationError } = await client.from('organizations').upsert({
    id: input.nonprofitId,
    created_by: input.ownerId,
    slug: input.nonprofitSlug,
    legal_name: input.auction.organization,
    display_name: input.auction.organization,
  }, { onConflict: 'id' });
  if (organizationError) throw organizationError;

  const { error: auctionError } = await client.from('auctions').upsert({
    id: input.auctionId,
    organization_id: input.nonprofitId,
    created_by: input.ownerId,
    slug: `${slug(input.auction.name) || 'auction'}-${input.auctionId.slice(0, 8)}`,
    name: input.auction.name,
    description: input.auction.description || '',
    event_type: input.auction.eventType || 'online_silent',
    status: input.auction.eventType === 'live' ? 'scheduled' : input.auction.starts > Date.now() ? 'scheduled' : 'live',
    opens_at: new Date(input.auction.starts).toISOString(),
    closes_at: new Date(input.auction.ends).toISOString(),
    timezone: input.auction.timezone || 'America/Denver',
    event_starts_at: input.auction.eventStartsAt ? new Date(input.auction.eventStartsAt).toISOString() : null,
    venue_name: input.auction.venueName || null,
    venue_address: input.auction.venueAddress || null,
    planning_notes: input.auction.planningNotes || null,
    planned_capabilities: input.auction.plannedCapabilities || { liveAuction: false, silentAuction: true, donationAppeal: false },
    live_session_status: input.auction.liveSessionStatus || 'not_started',
    platform_fee_bps: 500,
    organizer_fee_share_percent: input.auction.feePolicy.organizerPercent,
    processing_fees_separate: true,
  }, { onConflict: 'id' });
  if (auctionError) throw auctionError;

  const { data: existingItems, error: existingItemsError } = await client.from('auction_items').select('id').eq('auction_id', input.auctionId);
  if (existingItemsError) throw existingItemsError;
  const currentIds = new Set(input.auction.items.map(item => item.id));
  const removedIds = (existingItems || []).map(row => row.id).filter(id => !currentIds.has(id));
  if (removedIds.length) {
    const { error: removeError } = await client.from('auction_items').delete().in('id', removedIds);
    if (removeError) throw removeError;
  }
  if (!input.auction.items.length) return;
  const codes = input.auction.items.map(item => item.giveHolidaysPackageCode).filter((value): value is string => Boolean(value));
  const packages = codes.length
    ? (await client.from('travel_packages').select('*').in('provider_code', codes)).data || []
    : [];
  const packageByCode = new Map(packages.map(row => [row.provider_code, row]));
  const rows = input.auction.items.map((item, position) => {
    const travelPackage = item.giveHolidaysPackageCode ? packageByCode.get(item.giveHolidaysPackageCode) : null;
    if (item.source === 'give-holidays' && !travelPackage) throw new Error(`Give Holidays package ${item.giveHolidaysPackageCode || item.title} is missing from Supabase.`);
    return {
      id: item.id,
      auction_id: input.auctionId,
      source: item.source === 'give-holidays' ? 'give_holidays' : 'custom',
      title: item.title,
      description: item.description,
      category: item.category,
      donor_name: item.donor,
      image_url: item.image || null,
      fair_market_value_cents: item.value,
      starting_bid_cents: item.start,
      bid_increment_cents: item.increment,
      buy_now_cents: item.buyNow || null,
      give_holidays_package_code: item.giveHolidaysPackageCode || null,
      travel_package_id: travelPackage?.id || null,
      travel_package_snapshot: travelPackage ? {
        title: travelPackage.title,
        destination: travelPackage.destination,
        region: travelPackage.region,
        category: travelPackage.category,
        cardDescription: travelPackage.card_description || travelPackage.summary,
        fullDescription: travelPackage.full_description || travelPackage.summary,
        heroImageUrl: travelPackage.hero_image_url || travelPackage.image_url,
        galleryUrls: travelPackage.gallery_urls || [],
        fairMarketValueCents: travelPackage.fair_market_value_cents,
        included: travelPackage.included,
        notIncluded: travelPackage.not_included,
        stayLength: travelPackage.stay_length,
        occupancy: travelPackage.occupancy,
        roomType: travelPackage.room_type,
        expirationDate: travelPackage.expiration_date,
        bookingLeadTimeDays: travelPackage.booking_lead_time_days,
        requiredTravelerDetails: travelPackage.required_traveler_details,
        cancellationTerms: travelPackage.cancellation_terms,
        refundTerms: travelPackage.refund_terms,
        redemptionInstructions: travelPackage.redemption_instructions,
        terms: travelPackage.terms,
      } : null,
      position,
      is_published: item.isPublished !== false,
    };
  });
  const { error: itemsError } = await client.from('auction_items').upsert(rows, { onConflict: 'id' });
  if (itemsError) throw itemsError;
  const settlementRows = rows.filter(row => row.travel_package_id).map(row => {
    const travelPackage = packageByCode.get(row.give_holidays_package_code!);
    return {
      auction_item_id: row.id,
      travel_package_id: row.travel_package_id!,
      wholesale_cost_cents: Number(travelPackage?.wholesale_cost_cents || 0),
      gather_markup_cents: Number(travelPackage?.platform_markup_cents || 0),
      supplier_name: travelPackage?.supplier_name || null,
      supplier_reference: travelPackage?.supplier_reference || null,
      internal_notes: travelPackage?.internal_notes || null,
    };
  });
  if (settlementRows.length) {
    const { error: settlementError } = await client.from('auction_item_settlements').upsert(settlementRows, { onConflict: 'auction_item_id' });
    if (settlementError) throw settlementError;
  }
}

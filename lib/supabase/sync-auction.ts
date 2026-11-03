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
    status: input.auction.starts > Date.now() ? 'scheduled' : 'live',
    opens_at: new Date(input.auction.starts).toISOString(),
    closes_at: new Date(input.auction.ends).toISOString(),
    platform_fee_bps: 500,
    organizer_fee_share_percent: input.auction.feePolicy.organizerPercent,
    processing_fees_separate: true,
  }, { onConflict: 'id' });
  if (auctionError) throw auctionError;

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
        providerCode: travelPackage.provider_code,
        title: travelPackage.title,
        destination: travelPackage.destination,
        region: travelPackage.region,
        wholesaleCostCents: travelPackage.wholesale_cost_cents,
        platformMarkupCents: travelPackage.platform_markup_cents,
        fairMarketValueCents: travelPackage.fair_market_value_cents,
        terms: travelPackage.terms,
      } : null,
      position,
      is_published: false,
    };
  });
  const { error: itemsError } = await client.from('auction_items').upsert(rows, { onConflict: 'id' });
  if (itemsError) throw itemsError;
}

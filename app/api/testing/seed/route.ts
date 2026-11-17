import { createAuction, type Auction } from "@/lib/auction";
import { defaultHomepage } from "@/lib/homepage";
import { database, nonprofitInsert, publicNonprofit, type Nonprofit } from "@/lib/nonprofits";
import { sandboxAccess, sandboxAccessError } from "@/lib/sandbox-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordSupporterActivity, upsertSupporter } from "@/lib/supabase/supporters";
import { syncCreatedAuctionToSupabase } from "@/lib/supabase/sync-auction";

export const dynamic = "force-dynamic";

const IDS = {
  organizations: [
    "71000000-0000-4000-8000-000000000001",
    "71000000-0000-4000-8000-000000000002",
  ],
  auctions: [
    "72000000-0000-4000-8000-000000000001",
    "72000000-0000-4000-8000-000000000002",
    "72000000-0000-4000-8000-000000000003",
    "72000000-0000-4000-8000-000000000004",
  ],
};

const supporters = [
  { name: "Avery Reed", email: "avery@sandbox.gatherforgood.bid", phone: "303-555-0101", tags: ["returning", "major-donor"], amount: 185000 },
  { name: "Jordan Lee", email: "jordan@sandbox.gatherforgood.bid", phone: "303-555-0102", tags: ["board-member", "gala"], amount: 72500 },
  { name: "Morgan Patel", email: "morgan@sandbox.gatherforgood.bid", phone: "303-555-0103", tags: ["travel-interest", "volunteer"], amount: 130000 },
  { name: "Riley Chen", email: "riley@sandbox.gatherforgood.bid", phone: "303-555-0104", tags: ["new-supporter"], amount: 45000 },
  { name: "Cameron Brooks", email: "cameron@sandbox.gatherforgood.bid", phone: "303-555-0105", tags: ["sponsor", "returning"], amount: 250000 },
  { name: "Taylor Williams", email: "taylor@sandbox.gatherforgood.bid", phone: "303-555-0106", tags: ["family", "auction-winner"], amount: 98000 },
];

function seededAuction(input: {
  id: string;
  name: string;
  organization: string;
  starts: number;
  ends: number;
  closed?: boolean;
  offset: number;
}) {
  const auction = createAuction(input.name, input.organization, {
    starts: input.starts,
    ends: input.ends,
    description: `A reusable Gather sandbox event for ${input.organization}.`,
    fulfillmentPolicy: {
      pickupEnabled: true,
      pickupAddress: "1250 Community Way, Denver, CO 80202",
      pickupInstructions: "Bring a photo ID to the welcome desk.",
      shippingEnabled: true,
      shippingFeeCents: 1500,
    },
    bidderFields: { phoneRequired: true, addressRequired: false, countryStateRequired: true },
  });
  auction.goal = input.offset % 2 ? 3500000 : 2500000;
  auction.items = auction.items.map((item, index) => ({
    ...item,
    id: `${input.id.slice(0, -1)}${index + 5}`,
    isPublished: true,
  }));
  const bidderIds = supporters.map((_, index) => `sandbox-bidder-${index + 1}`);
  auction.items[0].bids = [
    { user: bidderIds[0], max: 42500, at: input.starts + 3600000 },
    { user: bidderIds[1], max: 37500, at: input.starts + 7200000 },
  ];
  auction.items[0].leader = bidderIds[0];
  auction.items[0].price = 40000;
  auction.items[1].bids = [{ user: bidderIds[2], max: 22500, at: input.starts + 5400000 }];
  auction.items[1].leader = bidderIds[2];
  auction.items[1].price = auction.items[1].start;
  auction.items[2].bids = [
    { user: bidderIds[3], max: 16000, at: input.starts + 6000000 },
    { user: bidderIds[4], max: 18000, at: input.starts + 6600000 },
  ];
  auction.items[2].leader = bidderIds[4];
  auction.items[2].price = 17000;
  auction.watches[bidderIds[5]] = [auction.items[0].id, auction.items[3].id];
  auction.donations = [
    { user: bidderIds[1], amount: 10000, at: input.starts + 8000000 },
    { user: bidderIds[5], amount: 25000, at: input.starts + 9000000 },
  ];
  if (input.closed) {
    auction.items.slice(0, 3).forEach((item) => { item.sold = true; });
    auction.orders = auction.items.slice(0, 3).map((item, index) => ({
      id: `${input.id}-order-${index + 1}`,
      user: item.leader,
      item: item.title,
      amount: item.price,
      at: input.ends,
    }));
  }
  return auction;
}

async function upsertD1Organization(input: {
  id: string;
  owner: string;
  slug: string;
  name: string;
  headline: string;
  mission: string;
  accent: string;
  auctions: { id: string; state: Auction }[];
}) {
  const db = database();
  await nonprofitInsert(input.id, input.owner, input.name, input.slug).run();
  await db.prepare("UPDATE nonprofits SET owner=?,slug=?,name=?,headline=?,mission=?,accent=? WHERE id=?")
    .bind(input.owner, input.slug, input.name, input.headline, input.mission, input.accent, input.id).run();
  const nonprofit: Nonprofit = { id: input.id, owner: input.owner, slug: input.slug, name: input.name, headline: input.headline, mission: input.mission, accent: input.accent };
  const homepage = defaultHomepage(publicNonprofit(nonprofit), input.auctions.map(({ id, state }) => ({ id, name: state.name, starts: state.starts, ends: state.ends })));
  homepage.theme.primary = input.accent;
  await db.prepare("INSERT INTO nonprofit_homepages (nonprofit_id,draft,published,draft_version,updated_at,published_at) VALUES (?,?,?,?,?,?) ON CONFLICT(nonprofit_id) DO UPDATE SET draft=excluded.draft,published=excluded.published,updated_at=excluded.updated_at,published_at=excluded.published_at")
    .bind(input.id, JSON.stringify(homepage), JSON.stringify(homepage), 1, Date.now(), Date.now()).run();
  for (const { id, state } of input.auctions) {
    await db.prepare("INSERT INTO auctions (id,owner,state,version,nonprofit_id) VALUES (?,?,?,0,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,state=excluded.state,nonprofit_id=excluded.nonprofit_id")
      .bind(id, input.owner, JSON.stringify(state), input.id).run();
  }
  for (let index = 0; index < supporters.length; index++) {
    const supporter = supporters[index];
    await db.prepare("INSERT INTO registrations (nonprofit_id,user_id,name,email,created_at) VALUES (?,?,?,?,?) ON CONFLICT(nonprofit_id,user_id) DO UPDATE SET name=excluded.name,email=excluded.email")
      .bind(input.id, `sandbox-bidder-${index + 1}`, supporter.name, supporter.email, Date.now() - index * 86400000).run();
  }
}

async function seedSupabase(input: {
  organizationId: string;
  ownerId: string;
  slug: string;
  auctions: { id: string; state: Auction }[];
}) {
  const errors: string[] = [];
  for (const auction of input.auctions) {
    try {
      await syncCreatedAuctionToSupabase({
        auctionId: auction.id,
        nonprofitId: input.organizationId,
        ownerId: input.ownerId,
        nonprofitSlug: input.slug,
        auction: auction.state,
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Auction sync failed.");
    }
  }
  const client = createSupabaseAdminClient();
  for (let index = 0; index < supporters.length; index++) {
    const person = supporters[index];
    try {
      const supporter = await upsertSupporter({
        organizationId: input.organizationId,
        email: person.email,
        fullName: person.name,
        phone: person.phone,
        tags: person.tags,
        mailingAddress: { address: `${100 + index} Test Avenue`, city: "Denver", state: "CO", zip: "80202" },
        source: index < 2 ? "historical_import" : "auction_registration",
      });
      const primaryAuction = input.auctions[index % input.auctions.length];
      await recordSupporterActivity({
        organizationId: input.organizationId,
        email: person.email,
        fullName: person.name,
        source: "auction_registration",
        type: "auction_registration",
        dedupeKey: `sandbox-registration-${input.organizationId}-${index}`,
        auctionId: primaryAuction.id,
        occurredAt: new Date(primaryAuction.state.starts + index * 3600000).toISOString(),
      });
      await recordSupporterActivity({
        organizationId: input.organizationId,
        email: person.email,
        fullName: person.name,
        source: "bidder_activity",
        type: "bid_placed",
        dedupeKey: `sandbox-bid-${input.organizationId}-${index}`,
        auctionId: primaryAuction.id,
        itemId: primaryAuction.state.items[index % primaryAuction.state.items.length].id,
        amountCents: 15000 + index * 5000,
        occurredAt: new Date(primaryAuction.state.starts + (index + 2) * 3600000).toISOString(),
      });
      if (index % 2 === 0) await recordSupporterActivity({
        organizationId: input.organizationId,
        email: person.email,
        fullName: person.name,
        source: "payment",
        type: "payment_completed",
        dedupeKey: `sandbox-payment-${input.organizationId}-${index}`,
        auctionId: input.auctions[input.auctions.length - 1].id,
        amountCents: person.amount,
        occurredAt: new Date(input.auctions[input.auctions.length - 1].state.ends + 3600000).toISOString(),
      });
      await client.from("supporter_notes").upsert({
        id: `${input.organizationId.slice(0, -2)}${String(index + 20).padStart(2, "0")}`,
        supporter_id: supporter.id,
        organization_id: input.organizationId,
        author_id: input.ownerId,
        body: index % 2 ? "Follow up before the next gala about volunteer opportunities." : "Longtime supporter. Prefers email communication and travel experiences.",
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Supporter sync failed.");
    }
  }
  return errors;
}

export async function POST(request: Request) {
  const access = await sandboxAccess();
  const configuredSeedToken = process.env.SANDBOX_SEED_TOKEN?.trim();
  const suppliedSeedToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const tokenAuthorized = process.env.GATHER_ENVIRONMENT === "staging"
    && Boolean(configuredSeedToken)
    && suppliedSeedToken === configuredSeedToken;
  const ownerId = access.allowed && access.user
    ? access.user.userId
    : tokenAuthorized
      ? process.env.SANDBOX_SEED_OWNER_ID?.trim()
      : undefined;

  if (!ownerId) return sandboxAccessError(access.reason);
  if (!tokenAuthorized && request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const body = await request.json().catch(() => null) as { action?: string } | null;
  if (body?.action !== "seed-organizer-foundation")
    return Response.json({ error: "Confirm the sandbox seed action." }, { status: 400 });

  const now = Date.now();
  const organizations = [
    {
      id: IDS.organizations[0], slug: "bright-futures-learning", name: "Bright Futures Learning Foundation",
      headline: "Opening doors through education.", mission: "Bright Futures helps students access tutoring, technology, and life-changing learning opportunities.", accent: "#175b47",
      auctions: [
        { id: IDS.auctions[0], state: seededAuction({ id: IDS.auctions[0], name: "Spring Into Possibility", organization: "Bright Futures Learning Foundation", starts: now - 2 * 86400000, ends: now + 12 * 86400000, offset: 0 }) },
        { id: IDS.auctions[1], state: seededAuction({ id: IDS.auctions[1], name: "2026 Bright Futures Gala", organization: "Bright Futures Learning Foundation", starts: now - 45 * 86400000, ends: now - 30 * 86400000, closed: true, offset: 1 }) },
      ],
    },
    {
      id: IDS.organizations[1], slug: "mountain-paws-rescue", name: "Mountain Paws Rescue",
      headline: "A safe home for every animal.", mission: "Mountain Paws Rescue funds veterinary care, foster families, and permanent homes for animals in need.", accent: "#264d7e",
      auctions: [
        { id: IDS.auctions[2], state: seededAuction({ id: IDS.auctions[2], name: "Paws for a Cause Online Auction", organization: "Mountain Paws Rescue", starts: now - 86400000, ends: now + 9 * 86400000, offset: 2 }) },
        { id: IDS.auctions[3], state: seededAuction({ id: IDS.auctions[3], name: "Winter Rescue Benefit", organization: "Mountain Paws Rescue", starts: now - 90 * 86400000, ends: now - 75 * 86400000, closed: true, offset: 3 }) },
      ],
    },
  ];

  const syncErrors: string[] = [];
  for (const organization of organizations) {
    await upsertD1Organization({ ...organization, owner: ownerId });
    syncErrors.push(...await seedSupabase({ organizationId: organization.id, ownerId, slug: organization.slug, auctions: organization.auctions }));
  }
  return Response.json({
    ok: true,
    organizations: organizations.map((organization) => ({ id: organization.id, name: organization.name, slug: organization.slug, auctions: organization.auctions.map(({ id, state }) => ({ id, name: state.name })) })),
    supportersPerOrganization: supporters.length,
    syncWarnings: [...new Set(syncErrors)].slice(0, 10),
  }, { headers: { "cache-control": "no-store" } });
}

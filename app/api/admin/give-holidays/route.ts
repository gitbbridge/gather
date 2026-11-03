import { z } from 'zod';
import { getAppUser } from '@/lib/auth';
import { isPlatformAdmin } from '@/lib/platform-admin';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const packageInput = z.object({
  id: z.string().uuid().optional(),
  providerCode: z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9_-]+$/),
  destination: z.string().trim().min(2).max(100),
  region: z.string().trim().min(2).max(100),
  title: z.string().trim().min(2).max(140),
  summary: z.string().trim().max(2000),
  imageUrl: z.union([z.string().url(), z.literal('')]),
  wholesaleCostCents: z.number().int().min(0).max(100_000_000),
  platformMarkupCents: z.number().int().min(0).max(100_000_000),
  fairMarketValueCents: z.number().int().min(0).max(100_000_000),
  suggestedStartingBidCents: z.number().int().min(0).max(100_000_000),
  status: z.enum(['draft', 'available', 'paused', 'retired']),
  isActive: z.boolean(),
  terms: z.object({
    nights: z.string().trim().max(80).optional(),
    guests: z.string().trim().max(80).optional(),
    validity: z.string().trim().max(200).optional(),
    blackoutDates: z.string().trim().max(500).optional(),
    inclusions: z.string().trim().max(2000).optional(),
    restrictions: z.string().trim().max(2000).optional(),
  }),
});

const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store' },
});

function slug(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function publicPackage(row: Record<string, unknown>) {
  return {
    id: row.id,
    providerCode: row.provider_code,
    destination: row.destination,
    region: row.region,
    title: row.title,
    summary: row.summary,
    imageUrl: row.image_url || '',
    wholesaleCostCents: row.wholesale_cost_cents,
    platformMarkupCents: row.platform_markup_cents,
    fairMarketValueCents: row.fair_market_value_cents,
    suggestedStartingBidCents: row.suggested_starting_bid_cents,
    status: row.status,
    isActive: row.is_active,
    terms: row.terms || {},
  };
}

async function requirePlatformAdmin() {
  const user = await getAppUser();
  return isPlatformAdmin(user) ? user : null;
}

export async function GET() {
  try {
    if (!await requirePlatformAdmin()) return json({ error: 'Platform administrator access required.' }, 403);
    const { data, error } = await createSupabaseAdminClient()
      .from('travel_packages')
      .select('*')
      .order('destination');
    if (error) throw error;
    return json({ packages: (data || []).map(row => publicPackage(row)) });
  } catch (error) {
    console.error('Unable to load Give Holidays packages:', error);
    return json({ error: 'Unable to load the travel catalog. Apply the latest Supabase migration and try again.' }, 500);
  }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Invalid request origin.' }, 403);
    if (!await requirePlatformAdmin()) return json({ error: 'Platform administrator access required.' }, 403);
    if (Number(request.headers.get('content-length') || 0) > 20_000) return json({ error: 'Request too large.' }, 413);
    const parsed = packageInput.safeParse(await request.json());
    if (!parsed.success) return json({ error: 'Review the package details and try again.' }, 400);
    const value = parsed.data;
    if (value.isActive && (value.status !== 'available' || value.wholesaleCostCents <= 0 || value.fairMarketValueCents <= 0)) {
      return json({ error: 'Active packages must be available and include wholesale cost and fair-market value.' }, 400);
    }
    const record = {
      provider_code: value.providerCode.toUpperCase(),
      slug: slug(value.destination),
      destination: value.destination,
      region: value.region,
      title: value.title,
      summary: value.summary,
      image_url: value.imageUrl || null,
      wholesale_cost_cents: value.wholesaleCostCents,
      platform_markup_cents: value.platformMarkupCents,
      fair_market_value_cents: value.fairMarketValueCents,
      suggested_starting_bid_cents: value.suggestedStartingBidCents,
      status: value.status,
      is_active: value.isActive,
      terms: value.terms,
    };
    const client = createSupabaseAdminClient();
    const query = value.id
      ? client.from('travel_packages').update(record).eq('id', value.id)
      : client.from('travel_packages').insert(record);
    const { data, error } = await query.select('*').single();
    if (error) throw error;
    return json({ package: publicPackage(data) });
  } catch (error) {
    console.error('Unable to save Give Holidays package:', error);
    return json({ error: 'Unable to save the package. Check that its code and destination are unique.' }, 500);
  }
}

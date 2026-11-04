import { getAppUser } from '@/lib/auth';
import { database, publicNonprofit, type Nonprofit } from '@/lib/nonprofits';
import { defaultHomepage, homepageConfigSchema, homepageReadiness, parseHomepage } from '@/lib/homepage';
import type { Auction } from '@/lib/auction';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
const mutation = z.object({ action: z.enum(['save', 'publish']), nonprofitId: z.string().min(1).max(100), baseVersion: z.number().int().min(0), config: homepageConfigSchema });
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

async function ownedNonprofit(userId: string, requestedId?: string) {
  const sql = requestedId ? 'SELECT * FROM nonprofits WHERE id=? AND owner=?' : 'SELECT * FROM nonprofits WHERE owner=? ORDER BY rowid LIMIT 1';
  return requestedId ? database().prepare(sql).bind(requestedId, userId).first<Nonprofit>() : database().prepare(sql).bind(userId).first<Nonprofit>();
}
async function auctionRows(nonprofitId: string) {
  const rows = (await database().prepare('SELECT id,state FROM auctions WHERE nonprofit_id=? ORDER BY rowid DESC').bind(nonprofitId).all<{ id: string; state: string }>()).results;
  return rows.map(row => ({ id: row.id, state: JSON.parse(row.state) as Auction }));
}

export async function GET(request: Request) {
  try {
    const user = await getAppUser();
    if (!user) return json({ error: 'Sign in to edit a homepage.' }, 401);
    const nonprofit = await ownedNonprofit(user.userId, new URL(request.url).searchParams.get('nonprofit') || undefined);
    if (!nonprofit) return json({ error: 'Create a nonprofit page before opening the Homepage Builder.' }, 404);
    const auctions = await auctionRows(nonprofit.id);
    const row = await database().prepare('SELECT draft,published,draft_version as draftVersion,updated_at as updatedAt,published_at as publishedAt FROM nonprofit_homepages WHERE nonprofit_id=?').bind(nonprofit.id).first<{ draft: string; published: string | null; draftVersion: number; updatedAt: number; publishedAt: number | null }>();
    const publicFields = publicNonprofit(nonprofit);
    return json({ nonprofit: publicFields, auctions, config: parseHomepage(row?.draft) || defaultHomepage(publicFields, auctions), version: row?.draftVersion || 0, updatedAt: row?.updatedAt || null, publishedAt: row?.publishedAt || null, hasPublished: Boolean(parseHomepage(row?.published)) });
  } catch (error) { console.error(error); return json({ error: 'Unable to load the Homepage Builder.' }, 500); }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Invalid origin.' }, 403);
    const user = await getAppUser();
    if (!user) return json({ error: 'Sign in to continue.' }, 401);
    const raw = await request.text();
    if (raw.length > 250_000) return json({ error: 'Homepage content is too large.' }, 413);
    const parsed = mutation.safeParse(JSON.parse(raw));
    if (!parsed.success) return json({ error: 'Review the highlighted homepage content and try again.', details: parsed.error.flatten() }, 400);
    const { action, nonprofitId, baseVersion, config } = parsed.data;
    if (!await ownedNonprofit(user.userId, nonprofitId)) return json({ error: 'Only the nonprofit organizer can edit this homepage.' }, 403);
    if (action === 'publish') { const issues = homepageReadiness(config, await auctionRows(nonprofitId)); if (issues.length) return json({ error: `Complete ${issues.length} item${issues.length === 1 ? '' : 's'} before publishing.`, issues }, 400); }
    const now = Date.now();
    const encoded = JSON.stringify(config);
    let result;
    if (baseVersion === 0) {
      result = await database().prepare(action === 'publish'
        ? 'INSERT INTO nonprofit_homepages (nonprofit_id,draft,published,draft_version,updated_at,published_at) SELECT ?,?,?,1,?,? WHERE NOT EXISTS (SELECT 1 FROM nonprofit_homepages WHERE nonprofit_id=?)'
        : 'INSERT INTO nonprofit_homepages (nonprofit_id,draft,published,draft_version,updated_at,published_at) SELECT ?,?,NULL,1,?,NULL WHERE NOT EXISTS (SELECT 1 FROM nonprofit_homepages WHERE nonprofit_id=?)')
        .bind(...(action === 'publish' ? [nonprofitId, encoded, encoded, now, now, nonprofitId] : [nonprofitId, encoded, now, nonprofitId])).run();
    } else {
      result = await database().prepare(action === 'publish'
        ? 'UPDATE nonprofit_homepages SET draft=?,published=?,draft_version=draft_version+1,updated_at=?,published_at=? WHERE nonprofit_id=? AND draft_version=?'
        : 'UPDATE nonprofit_homepages SET draft=?,draft_version=draft_version+1,updated_at=? WHERE nonprofit_id=? AND draft_version=?')
        .bind(...(action === 'publish' ? [encoded, encoded, now, now, nonprofitId, baseVersion] : [encoded, now, nonprofitId, baseVersion])).run();
    }
    if (!result.meta.changes) return json({ error: 'This homepage changed in another session. Reload before saving again.', conflict: true }, 409);
    return json({ ok: true, version: baseVersion + 1, updatedAt: now, publishedAt: action === 'publish' ? now : undefined });
  } catch (error) { console.error(error); return json({ error: 'Unable to save homepage changes.' }, 500); }
}

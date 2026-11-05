import { z } from 'zod';
import { managedOrganization } from '@/lib/organizer-access';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordSupporterActivity, upsertSupporter } from '@/lib/supabase/supporters';
import { supporterCsvTemplate, validateSupporterCsv } from '@/lib/supporter-import';

export const dynamic = 'force-dynamic';
const uuid = z.string().uuid();
const action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('manual'), organizationId: uuid, fullName: z.string().trim().min(1).max(100), email: z.string().email(), phone: z.string().trim().max(40).optional(), tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]) }),
  z.object({ action: z.literal('note'), organizationId: uuid, supporterId: uuid, body: z.string().trim().min(1).max(4000) }),
  z.object({ action: z.literal('tags'), organizationId: uuid, supporterId: uuid, tags: z.array(z.string().trim().min(1).max(40)).max(30) }),
  z.object({ action: z.literal('segment'), organizationId: uuid, name: z.string().trim().min(2).max(100), filters: z.record(z.string(), z.unknown()) }),
  z.object({ action: z.literal('import'), organizationId: uuid, csv: z.string().min(1).max(2_000_000), commit: z.boolean().default(false) }),
  z.object({ action: z.literal('merge'), organizationId: uuid, targetId: uuid, duplicateId: uuid }),
]);

type RawActivity = { activity_type:string;amount_cents:number|null;auction_id:string|null;[key:string]:unknown };
type RawSupporter = { id:string;full_name:string;email:string;phone:string|null;tags:string[];user_id:string|null;mailing_address:Record<string,string>;supporter_activities?:RawActivity[];supporter_notes?:unknown[];[key:string]:unknown };
type SupporterSummary = RawSupporter & { activities:RawActivity[];notes:unknown[];lifetimeConfirmedPaidCents:number;totalWinningBidCents:number;historicalContributionCents:number;auctionsParticipated:number;auctionIds:string[];itemsWon:number;hasBid:boolean;hasPayment:boolean;isReturning:boolean };

function summarize(supporter: RawSupporter): SupporterSummary {
  const activities = supporter.supporter_activities || [];
  const payments = activities.filter(activity => activity.activity_type === 'payment_completed').reduce((sum, activity) => sum + Number(activity.amount_cents || 0), 0);
  const refunds = activities.filter(activity => ['payment_refunded','payment_partially_refunded'].includes(activity.activity_type)).reduce((sum, activity) => sum + Number(activity.amount_cents || 0), 0);
  const historical = activities.filter(activity => activity.activity_type === 'historical_contribution').reduce((sum, activity) => sum + Number(activity.amount_cents || 0), 0);
  const wins = activities.filter(activity => activity.activity_type === 'item_won');
  const auctions = new Set(activities.map(activity => activity.auction_id).filter(Boolean));
  return { ...supporter, activities, notes: supporter.supporter_notes || [], lifetimeConfirmedPaidCents: Math.max(0, payments - refunds), totalWinningBidCents: wins.reduce((sum, activity) => sum + Number(activity.amount_cents || 0), 0), historicalContributionCents: historical, auctionsParticipated: auctions.size, auctionIds: [...auctions] as string[], itemsWon: wins.length, hasBid: activities.some(activity => activity.activity_type === 'bid_placed'), hasPayment: payments > 0, isReturning: auctions.size > 1 };
}

async function loadSupporters(organizationId: string) {
  const { data, error } = await createSupabaseAdminClient().from('supporters').select(`*,supporter_activities(*,auctions(name),auction_items(title)),supporter_notes(*)`).eq('organization_id', organizationId).order('last_activity_at', { ascending: false });
  if (error) throw error;
  return ((data || []) as unknown as RawSupporter[]).map(summarize);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get('organization') || '';
    if (url.searchParams.get('template') === 'csv') return new Response(supporterCsvTemplate, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="gather-supporter-import-template.csv"' } });
    if (!uuid.safeParse(organizationId).success) return Response.json({ error: 'Choose a nonprofit.' }, { status: 400 });
    const access = await managedOrganization(organizationId);
    if (!access) return Response.json({ error: 'Access denied.' }, { status: 403 });
    const client = createSupabaseAdminClient();
    const supporters = await loadSupporters(organizationId);
    const { data: segments, error: segmentError } = await client.from('supporter_segments').select('*').eq('organization_id', organizationId).order('name');
    if (segmentError) throw segmentError;
    const { data: auctions, error: auctionError } = await client.from('auctions').select('id,name,opens_at,closes_at').eq('organization_id', organizationId).order('opens_at', { ascending: false });
    if (auctionError) throw auctionError;
    const totalConfirmed = supporters.reduce((sum, supporter) => sum + supporter.lifetimeConfirmedPaidCents, 0);
    const topSupporters = [...supporters].sort((a, b) => b.lifetimeConfirmedPaidCents - a.lifetimeConfirmedPaidCents).slice(0, 10).map(supporter => ({ id: supporter.id, name: supporter.full_name, email: supporter.email, amountCents: supporter.lifetimeConfirmedPaidCents }));
    const names = new Map<string, string[]>();
    supporters.forEach(supporter => { const key = supporter.full_name.trim().toLowerCase(); if (key) names.set(key, [...(names.get(key) || []), supporter.id]); });
    const potentialDuplicateGroups = [...names.values()].filter(ids => ids.length > 1);
    return Response.json({ organization: { id: access.nonprofit.id, name: access.nonprofit.name }, supporters, segments: segments || [], auctions: auctions || [], reporting: { totalUniqueSupporters: supporters.length, newSupporters: supporters.filter(supporter => !supporter.isReturning).length, returningSupporters: supporters.filter(supporter => supporter.isReturning).length, totalConfirmedPaidCents: totalConfirmed, topSupporters }, potentialDuplicateGroups }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) { console.error('Unable to load supporters:', error); return Response.json({ error: 'Unable to load supporter records.' }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
    const parsed = action.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: 'Check the supporter information and try again.' }, { status: 400 });
    const input = parsed.data;
    const access = await managedOrganization(input.organizationId);
    if (!access) return Response.json({ error: 'Access denied.' }, { status: 403 });
    const client = createSupabaseAdminClient();
    if (input.action === 'manual') {
      const supporter = await upsertSupporter({ organizationId: input.organizationId, email: input.email, fullName: input.fullName, phone: input.phone, tags: input.tags, source: 'manual' });
      return Response.json({ supporter });
    }
    if (input.action === 'note') {
      const { data: supporter } = await client.from('supporters').select('id,email,full_name').eq('id', input.supporterId).eq('organization_id', input.organizationId).maybeSingle();
      if (!supporter) return Response.json({ error: 'Supporter not found.' }, { status: 404 });
      const { data: note, error } = await client.from('supporter_notes').insert({ supporter_id: supporter.id, organization_id: input.organizationId, author_id: access.user.userId, body: input.body }).select('*').single();
      if (error) throw error;
      await recordSupporterActivity({ organizationId: input.organizationId, userId: null, email: supporter.email, fullName: supporter.full_name, source: 'manual', type: 'internal_note_added', dedupeKey: `note-${note.id}`, metadata: { noteId: note.id } });
      return Response.json({ note });
    }
    if (input.action === 'tags') {
      const { data: supporter, error: supporterError } = await client.from('supporters').select('*').eq('id', input.supporterId).eq('organization_id', input.organizationId).single();
      if (supporterError) throw supporterError;
      const before = new Set<string>(supporter.tags || []), after = new Set(input.tags);
      const { error } = await client.from('supporters').update({ tags: input.tags }).eq('id', supporter.id);
      if (error) throw error;
      for (const tag of after) if (!before.has(tag)) await recordSupporterActivity({ organizationId: input.organizationId, userId: supporter.user_id, email: supporter.email, fullName: supporter.full_name, source: 'manual', type: 'tag_added', dedupeKey: `tag-add-${supporter.id}-${tag}-${crypto.randomUUID()}`, metadata: { tag } });
      for (const tag of before) if (!after.has(tag)) await recordSupporterActivity({ organizationId: input.organizationId, userId: supporter.user_id, email: supporter.email, fullName: supporter.full_name, source: 'manual', type: 'tag_removed', dedupeKey: `tag-remove-${supporter.id}-${tag}-${crypto.randomUUID()}`, metadata: { tag } });
      return Response.json({ ok: true });
    }
    if (input.action === 'segment') {
      const { data, error } = await client.from('supporter_segments').upsert({ organization_id: input.organizationId, name: input.name, filters: input.filters, created_by: access.user.userId }, { onConflict: 'organization_id,name' }).select('*').single();
      if (error) throw error;
      return Response.json({ segment: data });
    }
    if (input.action === 'import') {
      const validation = validateSupporterCsv(input.csv);
      if (!input.commit || validation.errors.length) return Response.json(validation, { status: validation.errors.length ? 422 : 200 });
      let imported = 0;
      for (const row of validation.rows) {
        const supporter = await upsertSupporter({ organizationId: input.organizationId, email: row.email, fullName: row.fullName, phone: row.phone, mailingAddress: row.address, tags: row.tags, source: row.historicalContributionCents ? 'historical_import' : 'csv_import' });
        if (row.notes) {
          const { data: note, error: noteError } = await client.from('supporter_notes').insert({ supporter_id: supporter.id, organization_id: input.organizationId, author_id: access.user.userId, body: row.notes }).select('id').single();
          if (noteError) throw noteError;
          await recordSupporterActivity({ organizationId: input.organizationId, userId: supporter.user_id, email: row.email, fullName: row.fullName, source: 'csv_import', type: 'internal_note_added', dedupeKey: `import-note-${note.id}`, metadata: { imported: true } });
        }
        if (row.historicalContributionCents) await recordSupporterActivity({ organizationId: input.organizationId, userId: supporter.user_id, email: row.email, fullName: row.fullName, source: 'historical_import', type: 'historical_contribution', dedupeKey: `historical-${supporter.id}-${row.row}-${row.historicalContributionDate || 'undated'}`, amountCents: row.historicalContributionCents, occurredAt: row.historicalContributionDate || undefined, metadata: { imported: true } });
        imported++;
      }
      return Response.json({ imported, errors: [] });
    }
    if (input.targetId === input.duplicateId) return Response.json({ error: 'Choose two different records.' }, { status: 400 });
    const { data: records, error: recordsError } = await client.from('supporters').select('*').eq('organization_id', input.organizationId).in('id', [input.targetId, input.duplicateId]);
    if (recordsError || records?.length !== 2) return Response.json({ error: 'Both supporter records are required.' }, { status: 404 });
    const target = records.find(record => record.id === input.targetId)!, duplicate = records.find(record => record.id === input.duplicateId)!;
    await client.from('supporter_activities').update({ supporter_id: target.id }).eq('supporter_id', duplicate.id);
    await client.from('supporter_notes').update({ supporter_id: target.id }).eq('supporter_id', duplicate.id);
    await client.from('supporters').update({ tags: [...new Set([...(target.tags || []), ...(duplicate.tags || [])])], phone: target.phone || duplicate.phone, mailing_address: Object.keys(target.mailing_address || {}).length ? target.mailing_address : duplicate.mailing_address }).eq('id', target.id);
    const { error: deleteError } = await client.from('supporters').delete().eq('id', duplicate.id).eq('organization_id', input.organizationId);
    if (deleteError) throw deleteError;
    return Response.json({ ok: true, supporterId: target.id });
  } catch (error) { console.error('Unable to update supporters:', error); return Response.json({ error: 'Unable to save supporter records.' }, { status: 500 }); }
}

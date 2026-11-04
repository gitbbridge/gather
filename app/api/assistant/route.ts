import { z } from 'zod';
import { getAppUser, signInPath } from '@/lib/auth';
import { database, nonprofitById } from '@/lib/nonprofits';
import { askGatherAssistant, type AssistantContext } from '@/lib/assistant';
import type { Auction } from '@/lib/auction';

export const dynamic = 'force-dynamic';
const requestSchema = z.object({
  message: z.string().trim().min(1).max(2_000),
  conversationId: z.string().uuid().optional(),
  anonymousId: z.string().uuid().optional(),
  audience: z.enum(['bidder', 'organizer']),
  surface: z.enum(['onboarding', 'auction', 'item', 'my-wins', 'admin', 'travel']),
  auctionId: z.string().max(100).optional(),
  itemId: z.string().max(100).optional(),
  onboardingStep: z.number().int().min(0).max(4).optional(),
});

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

async function buildContext(input: z.infer<typeof requestSchema>, userId?: string): Promise<{ context: AssistantContext; nonprofitId: string | null }> {
  const context: AssistantContext = { audience: input.audience, surface: input.surface, onboardingStep: input.onboardingStep };
  if (input.audience === 'organizer' && !userId) throw new Error('SIGN_IN');
  if (!input.auctionId) return { context, nonprofitId: null };
  const row = await database().prepare('SELECT id, owner, nonprofit_id, state FROM auctions WHERE id=?').bind(input.auctionId).first<{id:string;owner:string;nonprofit_id:string|null;state:string}>();
  if (!row) throw new Error('NOT_FOUND');
  if (input.audience === 'organizer' && row.owner !== userId) throw new Error('FORBIDDEN');
  const state = JSON.parse(row.state) as Auction;
  context.auction = { id: row.id, name: state.name, organization: state.organization, starts: state.starts, ends: state.ends, paused: state.paused, feePolicy: state.feePolicy };
  if (row.nonprofit_id) {
    const nonprofit = await nonprofitById(row.nonprofit_id);
    if (nonprofit) context.nonprofit = { id: nonprofit.id, name: nonprofit.name, slug: nonprofit.slug, headline: nonprofit.headline, mission: nonprofit.mission };
  }
  if (input.itemId) {
    const item = state.items.find(candidate => candidate.id === input.itemId && (input.audience === 'organizer' || candidate.isPublished !== false));
    if (item) context.item = {
      id: item.id, title: item.title, category: item.category, description: item.description, donor: item.donor,
      value: item.value, start: item.start, increment: item.increment, buyNow: item.buyNow, price: item.price,
      ends: item.ends, source: item.source, travelTerms: item.travelTerms, eventNote: item.eventNote,
      donorCredit: item.donorCredit, bidCount: item.bids.length,
    };
  }
  return { context, nonprofitId: row.nonprofit_id };
}

export async function GET(request: Request) {
  const enabled = !!process.env.ANTHROPIC_API_KEY?.trim();
  const user = await getAppUser();
  const url = new URL(request.url);
  const conversationId = url.searchParams.get('conversationId') || '';
  const anonymousId = url.searchParams.get('anonymousId') || '';
  const principal = user?.userId || (z.string().uuid().safeParse(anonymousId).success ? `anon:${anonymousId}` : '');
  if (!conversationId || !principal) return json({ enabled, messages: [] });
  const conversation = await database().prepare('SELECT id,status FROM assistant_conversations WHERE id=? AND user_id=?').bind(conversationId, principal).first<{id:string;status:string}>();
  if (!conversation) return json({ enabled, messages: [] });
  const messages = (await database().prepare('SELECT sender,body,needs_escalation,created_at FROM assistant_messages WHERE conversation_id=? ORDER BY created_at ASC LIMIT 50').bind(conversationId).all()).results;
  return json({ enabled, conversationId, status: conversation.status, messages });
}

export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Invalid request origin.' }, 403);
    if (Number(request.headers.get('content-length') || 0) > 12_000) return json({ error: 'Request too large.' }, 413);
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return json({ error: 'Check the question and try again.' }, 400);
    const input = parsed.data;
    const user = await getAppUser();
    if (input.audience === 'organizer' && !user) return json({ error: 'Sign in to use organizer assistance.', signIn: signInPath('/onboarding') }, 401);
    const principal = user?.userId || (input.anonymousId ? `anon:${input.anonymousId}` : '');
    if (!principal) return json({ error: 'Open the assistant again and retry.' }, 400);
    const now = Date.now();
    const recent = await database().prepare(`SELECT count(*) AS n FROM assistant_messages m JOIN assistant_conversations c ON c.id=m.conversation_id WHERE c.user_id=? AND m.sender='user' AND m.created_at>=?`).bind(principal, now - 60_000).first<{n:number}>();
    if ((recent?.n || 0) >= 8) return json({ error: 'Please wait a moment before sending another question.' }, 429);
    let conversationId = input.conversationId;
    if (conversationId) {
      const owned = await database().prepare('SELECT id FROM assistant_conversations WHERE id=? AND user_id=?').bind(conversationId, principal).first();
      if (!owned) return json({ error: 'Conversation not found.' }, 404);
    }
    const { context, nonprofitId } = await buildContext(input, user?.userId);
    if (!conversationId) conversationId = crypto.randomUUID();
    const history = (await database().prepare('SELECT sender,body FROM assistant_messages WHERE conversation_id=? ORDER BY created_at DESC LIMIT 8').bind(conversationId).all<{sender:string;body:string}>()).results.reverse();
    const reply = await askGatherAssistant({ context, question: input.message, history });
    const writes = [];
    if (!input.conversationId) writes.push(database().prepare('INSERT INTO assistant_conversations (id,nonprofit_id,auction_id,item_id,user_id,user_email,audience,status,subject,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(conversationId, nonprofitId, input.auctionId || null, input.itemId || null, principal, user?.email || null, input.audience, 'active', input.message.slice(0, 140), now, now));
    writes.push(database().prepare('INSERT INTO assistant_messages (id,conversation_id,sender,body,needs_escalation,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(), conversationId, 'user', input.message, 0, now));
    writes.push(database().prepare('INSERT INTO assistant_messages (id,conversation_id,sender,body,needs_escalation,model,input_tokens,output_tokens,latency_ms,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), conversationId, 'assistant', reply.answer, reply.needsEscalation ? 1 : 0, reply.model, reply.inputTokens, reply.outputTokens, reply.latencyMs, now + 1));
    writes.push(database().prepare('UPDATE assistant_conversations SET updated_at=? WHERE id=?').bind(now + 1, conversationId));
    await database().batch(writes);
    return json({ conversationId, answer: reply.answer, needsEscalation: reply.needsEscalation, canEscalate: !!user && !!nonprofitId });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'SIGN_IN') return json({ error: 'Sign in to use organizer assistance.' }, 401);
    if (message === 'FORBIDDEN') return json({ error: 'You do not have access to this auction.' }, 403);
    if (message === 'NOT_FOUND') return json({ error: 'Auction not found.' }, 404);
    console.error('Gather Assistant request failed', error instanceof Error ? error.name : 'unknown');
    return json({ error: message.includes('ANTHROPIC_API_KEY') ? 'The Gather Assistant is being connected. Please try again soon.' : 'The Gather Assistant is temporarily unavailable. Core auction features are unaffected.' }, 503);
  }
}

import { z } from 'zod';
import { getAppUser } from '@/lib/auth';
import { database } from '@/lib/nonprofits';

const replySchema = z.object({ conversationId: z.string().uuid(), body: z.string().trim().min(1).max(2_000), resolve: z.boolean().optional() });
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET() {
  const user = await getAppUser();
  if (!user) return json({ error: 'Sign in to view messages.' }, 401);
  const conversations = (await database().prepare(`SELECT c.id,c.subject,c.status,c.auction_id,c.item_id,c.user_email,c.created_at,c.updated_at,n.name AS nonprofit_name,a.state AS auction_state FROM assistant_conversations c JOIN nonprofits n ON n.id=c.nonprofit_id LEFT JOIN auctions a ON a.id=c.auction_id WHERE n.owner=? AND c.status IN ('escalated','resolved') ORDER BY c.updated_at DESC LIMIT 100`).bind(user.userId).all<Record<string, unknown>>()).results;
  const hydrated = await Promise.all(conversations.map(async conversation => {
    const messages = (await database().prepare('SELECT id,sender,body,created_at FROM assistant_messages WHERE conversation_id=? ORDER BY created_at ASC').bind(conversation.id).all()).results;
    let auctionName = 'Auction';
    try { if (conversation.auction_state) auctionName = JSON.parse(String(conversation.auction_state)).name || auctionName; } catch { /* Optional display context. */ }
    const safe = { ...conversation };
    delete (safe as { auction_state?: unknown }).auction_state;
    return { ...safe, auctionName, messages };
  }));
  return json({ conversations: hydrated });
}

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Invalid request origin.' }, 403);
  const user = await getAppUser();
  if (!user) return json({ error: 'Sign in to reply.' }, 401);
  const parsed = replySchema.safeParse(await request.json());
  if (!parsed.success) return json({ error: 'Enter a reply.' }, 400);
  const conversation = await database().prepare('SELECT c.id FROM assistant_conversations c JOIN nonprofits n ON n.id=c.nonprofit_id WHERE c.id=? AND n.owner=?').bind(parsed.data.conversationId, user.userId).first();
  if (!conversation) return json({ error: 'Conversation not found.' }, 404);
  const now = Date.now();
  await database().batch([
    database().prepare('INSERT INTO assistant_messages (id,conversation_id,sender,body,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), parsed.data.conversationId, 'organizer', parsed.data.body, now),
    database().prepare(`UPDATE assistant_conversations SET status=?,resolved_at=?,updated_at=? WHERE id=?`).bind(parsed.data.resolve ? 'resolved' : 'escalated', parsed.data.resolve ? now : null, now, parsed.data.conversationId),
  ]);
  return json({ ok: true });
}

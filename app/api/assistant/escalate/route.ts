import { z } from 'zod';
import { getAppUser, signInPath } from '@/lib/auth';
import { database } from '@/lib/nonprofits';

const input = z.object({ conversationId: z.string().uuid() });
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Invalid request origin.' }, 403);
  const user = await getAppUser();
  if (!user) return json({ error: 'Sign in so the organizer can reply to you.', signIn: signInPath(new URL(request.url).searchParams.get('returnTo') || '/') }, 401);
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return json({ error: 'Conversation not found.' }, 400);
  const conversation = await database().prepare('SELECT id,nonprofit_id,user_id FROM assistant_conversations WHERE id=?').bind(parsed.data.conversationId).first<{id:string;nonprofit_id:string|null;user_id:string}>();
  if (!conversation || conversation.user_id !== user.userId) return json({ error: 'Conversation not found.' }, 404);
  if (!conversation.nonprofit_id) return json({ error: 'This question is not linked to an auction organizer.' }, 400);
  const now = Date.now();
  await database().prepare("UPDATE assistant_conversations SET status='escalated',escalated_at=COALESCE(escalated_at,?),updated_at=? WHERE id=?").bind(now, now, conversation.id).run();
  return json({ ok: true, status: 'escalated' });
}

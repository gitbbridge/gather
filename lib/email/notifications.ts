import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendTemplateEmail } from './resend';
import { deliveryTemplateKey } from './notification-values';

export { dateTime, money } from './notification-values';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TrackedTemplateEmail = {
  userId: string;
  recipientEmail?: string;
  auctionId?: string | null;
  templateId: string;
  values: Record<string, string>;
  dedupeKey: string;
};

async function userEmail(userId: string, supplied?: string) {
  if (supplied?.trim()) return supplied.trim();
  const { data, error } = await createSupabaseAdminClient().auth.admin.getUserById(userId);
  if (error || !data.user?.email) throw new Error('The notification recipient does not have an email address.');
  return data.user.email;
}

export async function sendTrackedTemplateEmail(input: TrackedTemplateEmail) {
  const client = createSupabaseAdminClient();
  const recipient = await userEmail(input.userId, input.recipientEmail);
  const template = deliveryTemplateKey(input.templateId, input.dedupeKey);
  const canTrack = uuidPattern.test(input.userId);
  const auctionId = input.auctionId && uuidPattern.test(input.auctionId) ? input.auctionId : null;
  let deliveryId = '';

  if (canTrack) {
    const { data: existing } = await client.from('notification_deliveries').select('id,status,provider_reference')
      .eq('user_id', input.userId).eq('channel', 'email').eq('template', template).maybeSingle();
    if (existing?.status === 'sent') return { id: existing.provider_reference || existing.id, duplicate: true };
    if (existing) deliveryId = existing.id;
    else {
      const { data, error } = await client.from('notification_deliveries').insert({
        user_id: input.userId,
        auction_id: auctionId,
        channel: 'email',
        template,
        status: 'pending',
      }).select('id').single();
      if (error) throw error;
      deliveryId = data.id;
    }
  }

  try {
    const sent = await sendTemplateEmail({
      to: recipient,
      templateId: input.templateId,
      values: input.values,
      idempotencyKey: `gather-${input.dedupeKey}`.slice(0, 250),
    });
    if (deliveryId) await client.from('notification_deliveries').update({ status: 'sent', provider_reference: sent.id, sent_at: new Date().toISOString() }).eq('id', deliveryId);
    return { id: sent.id, duplicate: false };
  } catch (error) {
    if (deliveryId) await client.from('notification_deliveries').update({ status: 'failed' }).eq('id', deliveryId);
    throw error;
  }
}

export async function safelySendTrackedTemplateEmail(input: TrackedTemplateEmail) {
  try {
    return await sendTrackedTemplateEmail(input);
  } catch (error) {
    console.error(`Unable to deliver ${input.templateId} email:`, error);
    return null;
  }
}

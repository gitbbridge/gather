import { renderEmailTemplate } from './templates.ts';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
export const DEFAULT_FROM_EMAIL = 'Gather for Good <noreply@gatherforgood.bid>';
export const DEFAULT_BCC_EMAIL = 'admin@gatherforgood.bid';

type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  idempotencyKey?: string;
};

type SendTemplateEmailInput = {
  to: string | string[];
  templateId: string;
  values: Record<string, string>;
  replyTo?: string;
  idempotencyKey?: string;
};

function requiredApiKey() {
  const value = process.env.RESEND_API_KEY?.trim();
  if (!value) throw new Error('RESEND_API_KEY is not configured.');
  return value;
}

function recipients(value: string | string[]) {
  const list = (Array.isArray(value) ? value : [value]).map(item => item.trim()).filter(Boolean);
  if (!list.length || list.some(item => !/^\S+@\S+\.\S+$/.test(item))) throw new Error('A valid email recipient is required.');
  return list;
}

export async function sendEmail(input: SendEmailInput) {
  const to = recipients(input.to);
  const configuredBcc = process.env.RESEND_BCC_EMAIL?.trim() || DEFAULT_BCC_EMAIL;
  const bcc = recipients(configuredBcc).filter(
    address => !to.some(primary => primary.toLowerCase() === address.toLowerCase()),
  );

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${requiredApiKey()}`,
      'content-type': 'application/json',
      ...(input.idempotencyKey ? { 'idempotency-key': input.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM_EMAIL,
      to,
      ...(bcc.length ? { bcc } : {}),
      subject: input.subject.replace(/[\r\n]+/g, ' ').trim(),
      html: input.html,
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    }),
  });

  const result = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string };
  if (!response.ok || !result.id) throw new Error(result.message || result.name || `Resend rejected the email (${response.status}).`);
  return { id: result.id };
}

export async function sendTemplateEmail(input: SendTemplateEmailInput) {
  const rendered = renderEmailTemplate(input.templateId, input.values);
  return sendEmail({
    to: input.to,
    subject: rendered.subject,
    html: rendered.html,
    replyTo: input.replyTo,
    idempotencyKey: input.idempotencyKey,
  });
}

import { sendEmail } from '@/lib/email/resend';
import { emailTemplates, previewTemplate } from '@/lib/email/templates';
import { platformSecurityAccess, privilegedAccessError } from '@/lib/security/privileged-access';

export const runtime = 'edge';

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Invalid request origin.' }, 403);
    const access = await platformSecurityAccess();
    if (!access.allowed || !access.user?.email) return privilegedAccessError();
    const user = access.user;
    if (Number(request.headers.get('content-length') || 0) > 2_000) return json({ error: 'Request too large.' }, 413);

    const body = await request.json().catch(() => ({})) as { templateId?: unknown };
    const template = emailTemplates.find(item => item.id === body.templateId);
    if (!template) return json({ error: 'Choose a valid email template.' }, 400);
    const preview = previewTemplate(template);
    const delivery = await sendEmail({
      to: user.email,
      subject: `[Test] ${preview.subject}`,
      html: preview.html,
      idempotencyKey: `admin-test-${user.userId}-${template.id}-${Date.now()}`,
    });
    return json({ ok: true, id: delivery.id, recipient: user.email });
  } catch (error) {
    console.error('Unable to send Resend test email:', error);
    return json({ error: error instanceof Error ? error.message : 'Unable to send the test email.' }, 500);
  }
}

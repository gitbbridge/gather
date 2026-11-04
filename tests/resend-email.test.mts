import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_BCC_EMAIL, DEFAULT_FROM_EMAIL, sendEmail } from '../lib/email/resend.ts';
import { dateTime, deliveryTemplateKey, money } from '../lib/email/notification-values.ts';

test('notification helpers create stable delivery keys and customer-facing values', () => {
  assert.equal(deliveryTemplateKey('outbid', 'auction-1-bid-2'), 'outbid::auction-1-bid-2');
  assert.equal(money(369000), '$3,690.00');
  assert.match(dateTime('2026-11-04T00:00:00.000Z'), /Nov 3, 2026/);
});

test('Resend delivery uses the Gather no-reply sender and protects the API key', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.RESEND_FROM_EMAIL;
  const originalBcc = process.env.RESEND_BCC_EMAIL;
  process.env.RESEND_API_KEY = 're_test_secret';
  delete process.env.RESEND_FROM_EMAIL;
  delete process.env.RESEND_BCC_EMAIL;
  let captured: { url?: string; init?: RequestInit } = {};
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    captured = { url: String(url), init };
    return new Response(JSON.stringify({ id: 'email_123' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    const result = await sendEmail({ to: 'bidder@example.org', subject: 'Receipt\r\nBcc: nope', html: '<p>Paid</p>' });
    assert.deepEqual(result, { id: 'email_123' });
    assert.equal(captured.url, 'https://api.resend.com/emails');
    assert.equal(new Headers(captured.init?.headers).get('authorization'), 'Bearer re_test_secret');
    const body = JSON.parse(String(captured.init?.body));
    assert.equal(body.from, DEFAULT_FROM_EMAIL);
    assert.deepEqual(body.to, ['bidder@example.org']);
    assert.deepEqual(body.bcc, [DEFAULT_BCC_EMAIL]);
    assert.equal(body.subject, 'Receipt Bcc: nope');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = originalKey;
    if (originalFrom === undefined) delete process.env.RESEND_FROM_EMAIL; else process.env.RESEND_FROM_EMAIL = originalFrom;
    if (originalBcc === undefined) delete process.env.RESEND_BCC_EMAIL; else process.env.RESEND_BCC_EMAIL = originalBcc;
  }
});

test('Resend delivery does not duplicate the monitoring address when it is the primary recipient', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.RESEND_API_KEY;
  const originalBcc = process.env.RESEND_BCC_EMAIL;
  process.env.RESEND_API_KEY = 're_test_secret';
  delete process.env.RESEND_BCC_EMAIL;
  let body: Record<string, unknown> = {};
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ id: 'email_456' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    await sendEmail({ to: DEFAULT_BCC_EMAIL, subject: 'Test message', html: '<p>Test</p>' });
    assert.deepEqual(body.to, [DEFAULT_BCC_EMAIL]);
    assert.equal('bcc' in body, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = originalKey;
    if (originalBcc === undefined) delete process.env.RESEND_BCC_EMAIL; else process.env.RESEND_BCC_EMAIL = originalBcc;
  }
});

test('Resend delivery fails closed when credentials are missing', async () => {
  const originalKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    await assert.rejects(() => sendEmail({ to: 'bidder@example.org', subject: 'Hello', html: '<p>Hello</p>' }), /RESEND_API_KEY/);
  } finally {
    if (originalKey !== undefined) process.env.RESEND_API_KEY = originalKey;
  }
});

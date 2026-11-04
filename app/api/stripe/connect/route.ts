import { z } from 'zod';
import { getAppUser } from '@/lib/auth';
import { nonprofitById } from '@/lib/nonprofits';
import { paymentAccount, paymentConnection, savePaymentAccount, stripeConnection } from '@/lib/payments';
import { stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

const input = z.object({
  nonprofitId: z.string().min(1).max(100),
  auctionId: z.string().min(1).max(100).optional(),
});

const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store' },
});

async function ownedNonprofit(nonprofitId: string, userId: string) {
  const nonprofit = await nonprofitById(nonprofitId);
  return nonprofit?.owner === userId ? nonprofit : null;
}

function returnPath(auctionId?: string) {
  return auctionId ? `/admin?auction=${encodeURIComponent(auctionId)}&stripe=returned` : '/admin?stripe=returned';
}

function publicBase(request: Request) {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, '');
  return configured && /^https?:\/\//.test(configured) ? configured : new URL(request.url).origin;
}

export async function GET(request: Request) {
  try {
    const user = await getAppUser();
    if (!user) return json({ error: 'Sign in to continue.' }, 401);
    const nonprofitId = new URL(request.url).searchParams.get('nonprofit') || '';
    const nonprofit = await ownedNonprofit(nonprofitId, user.userId);
    if (!nonprofit) return json({ error: 'Nonprofit not found or access denied.' }, 404);
    const stored = await paymentAccount(nonprofit.id);
    if (!stored) return json({ connection: await paymentConnection(nonprofit.id) });

    try {
      const account = await stripe().v2.core.accounts.retrieve(stored.stripeAccountId, {
        include: ['configuration.merchant', 'requirements', 'future_requirements'],
      });
      const connection = stripeConnection(account);
      await savePaymentAccount(nonprofit.id, account.id, connection);
      return json({ connection });
    } catch (error) {
      console.error('Unable to refresh Stripe account status:', error);
      return json({ connection: await paymentConnection(nonprofit.id), stale: true });
    }
  } catch (error) {
    console.error('Unable to load payment connection:', error);
    return json({ error: 'Unable to load payment setup.' }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (!origin || origin !== new URL(request.url).origin) return json({ error: 'Invalid request origin.' }, 403);
    const user = await getAppUser();
    if (!user) return json({ error: 'Sign in to continue.' }, 401);
    if (Number(request.headers.get('content-length') || 0) > 2_000) return json({ error: 'Request too large.' }, 413);
    const parsed = input.safeParse(await request.json());
    if (!parsed.success) return json({ error: 'Choose a nonprofit and try again.' }, 400);
    const { nonprofitId, auctionId } = parsed.data;
    const nonprofit = await ownedNonprofit(nonprofitId, user.userId);
    if (!nonprofit) return json({ error: 'Nonprofit not found or access denied.' }, 404);

    let stored = await paymentAccount(nonprofit.id);
    if (!stored) {
      const base = publicBase(request);
      const account = await stripe().v2.core.accounts.create({
        contact_email: user.email,
        display_name: nonprofit.name,
        dashboard: 'express',
        defaults: {
          currency: 'usd',
          locales: ['en-US'],
          profile: {
            business_url: `${base}/n/${encodeURIComponent(nonprofit.slug)}`,
            product_description: 'Nonprofit fundraising auctions and winning-bid payments.',
          },
          responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' },
        },
        configuration: {
          merchant: {
            capabilities: {
              card_payments: { requested: true },
            },
          },
        },
        metadata: { gather_nonprofit_id: nonprofit.id },
        include: ['configuration.merchant', 'requirements', 'future_requirements'],
      }, { idempotencyKey: `gather-connect-${nonprofit.id}` });
      await savePaymentAccount(nonprofit.id, account.id, stripeConnection(account));
      stored = await paymentAccount(nonprofit.id);
    }
    if (!stored) throw new Error('Stripe account could not be saved.');

    const callbackOrigin = new URL(request.url).origin;
    const refresh = new URL('/api/stripe/connect/refresh', callbackOrigin);
    refresh.searchParams.set('nonprofit', nonprofit.id);
    if (auctionId) refresh.searchParams.set('auction', auctionId);
    const link = await stripe().v2.core.accountLinks.create({
      account: stored.stripeAccountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          refresh_url: refresh.toString(),
          return_url: new URL(returnPath(auctionId), callbackOrigin).toString(),
          collection_options: { fields: 'eventually_due', future_requirements: 'include' },
        },
      },
    });
    return json({ url: link.url });
  } catch (error) {
    console.error('Unable to start Stripe onboarding:', error);
    return json({ error: 'Unable to start Stripe setup. Confirm that Connect is enabled in the Stripe Dashboard and try again.' }, 500);
  }
}

import { getAppUser } from '@/lib/auth';
import { nonprofitById } from '@/lib/nonprofits';
import { paymentAccount } from '@/lib/payments';
import { stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nonprofitId = url.searchParams.get('nonprofit') || '';
  const auctionId = url.searchParams.get('auction') || '';
  const returnUrl = new URL('/admin', url.origin);
  if (auctionId) returnUrl.searchParams.set('auction', auctionId);
  try {
    const user = await getAppUser();
    if (!user) return Response.redirect(new URL(`/auth?return_to=${encodeURIComponent(url.pathname + url.search)}`, url.origin), 303);
    const nonprofit = await nonprofitById(nonprofitId);
    if (!nonprofit || nonprofit.owner !== user.userId) {
      returnUrl.searchParams.set('stripe', 'missing');
      return Response.redirect(returnUrl, 303);
    }
    const stored = await paymentAccount(nonprofit.id);
    if (!stored) {
      returnUrl.searchParams.set('stripe', 'missing');
      return Response.redirect(returnUrl, 303);
    }
    const refreshUrl = new URL(url.pathname, url.origin);
    refreshUrl.searchParams.set('nonprofit', nonprofit.id);
    if (auctionId) refreshUrl.searchParams.set('auction', auctionId);
    returnUrl.searchParams.set('stripe', 'returned');
    const link = await stripe().v2.core.accountLinks.create({
      account: stored.stripeAccountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          refresh_url: refreshUrl.toString(),
          return_url: returnUrl.toString(),
          collection_options: { fields: 'eventually_due', future_requirements: 'include' },
        },
      },
    });
    return Response.redirect(link.url, 303);
  } catch (error) {
    console.error('Unable to refresh Stripe onboarding:', error);
    returnUrl.searchParams.set('stripe', 'error');
    return Response.redirect(returnUrl, 303);
  }
}

import Link from 'next/link';
import { HelpPolicyLayout } from '@/components/help-policy-layout';

export const metadata = { title: 'Help Center | Gather', description: 'Straightforward answers for Gather auction organizers and bidders.' };

export default function HelpCenterPage() {
  return <HelpPolicyLayout active="/help" title="Help Center" lede="Straightforward answers for auction organizers and bidders.">
    <h2>Get started</h2>
    <p><Link href="/help/organizers">Organizing an auction</Link> — Set up your organization, add items, choose how fees are covered, and review everything before launch.</p>
    <p><Link href="/help/bidders">Bidding in an auction</Link> — Find items, place bids, and understand what happens when you win.</p>
    <p><Link href="/help/fees">Fees and payments</Link> — Understand Gather’s 5% platform commission, configurable allocation, and separate payment-processing fees.</p>
    <p><Link href="/help/travel">Give Holidays experiences</Link> — Review package terms and the process for claiming a paid experience.</p>
    <h2>Policies and assistance</h2>
    <p><Link href="/legal/refunds">Refunds and fulfillment</Link> · <Link href="/legal/privacy">Privacy</Link> · <Link href="/legal/terms">Terms</Link> · <Link href="/legal/cookies">Cookies</Link> · <Link href="/support">Contact support</Link></p>
    <div className="mt-8 rounded-xl border-l-4 border-[#a79260] bg-[#f8f7f1] p-5 text-sm leading-6"><strong>Launch status:</strong> Gather is in production-readiness testing. Confirm payment, invoice, and fulfillment behavior before enabling a live-money auction.</div>
  </HelpPolicyLayout>;
}

import { HelpPolicyLayout } from '@/components/help-policy-layout';

export const metadata = { title: 'Help Center | Gather', description: 'Straightforward answers for Gather auction organizers and bidders.' };

export default function HelpCenterPage() {
  return <HelpPolicyLayout active="/help" title="Help Center" lede="Straightforward answers for auction organizers and bidders.">
    <h2 className="!mt-0">How can we help?</h2>
    <div className="grid gap-4 sm:grid-cols-2">
      {[
        ['/help/organizers', 'Organize an auction', 'Set up your organization, add items, choose fees, and launch with confidence.'],
        ['/help/bidders', 'Register and bid', 'Create an account, place bids, use maximum bidding, and understand what happens when you win.'],
        ['/help/fees', 'Fees and payments', 'See how the 5% platform commission and separate processing fees are calculated.'],
        ['/help/travel', 'Give Holidays experiences', 'Understand travel package terms, payment, claiming, and fulfillment.'],
      ].map(([href, heading, copy]) => <a key={href} href={href} className="group rounded-xl border border-[#dfe7e2] p-5 !no-underline transition hover:border-[#9fbcaa] hover:bg-[#f7faf8]">
        <span className="block text-base font-semibold text-[#193d30] group-hover:text-[#175b47]">{heading} <span aria-hidden="true">→</span></span>
        <span className="mt-2 block text-sm font-normal leading-6 text-[#63736a]">{copy}</span>
      </a>)}
    </div>
    <div className="mt-8 rounded-xl bg-[#edf4ef] p-6">
      <h2 className="!m-0 text-xl">Still need help?</h2>
      <p className="!mb-0 mt-2 text-sm">Visit <a href="/support">Contact Support</a> or email <a href="mailto:support@gatherforgood.bid">support@gatherforgood.bid</a>. Include the auction name and item title when applicable—never send a password or full card number.</p>
    </div>
    <h2>Policies and fulfillment</h2>
    <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm"><a href="/legal/refunds">Refunds &amp; Fulfillment</a><a href="/legal/privacy">Privacy Policy</a><a href="/legal/terms">Terms of Service</a><a href="/legal/cookies">Cookie Policy</a></div>
  </HelpPolicyLayout>;
}

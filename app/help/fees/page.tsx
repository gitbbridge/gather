import { HelpPolicyLayout } from '@/components/help-policy-layout';

export const metadata = { title: 'Fees & Payments | Gather' };
export default function FeesPage() { return <HelpPolicyLayout active="/help/fees" title="Fees & Payments" lede="A transparent 5% platform fee, capped at $100 per item.">
  <h2>One fee. Capped at $100.</h2><p>Gather charges a <strong>5% platform fee on winning bids, capped at $100 per item</strong>. A $200 item costs $10. A $5,000 item costs $100. The nonprofit chooses how that fee is allocated.</p><ul><li><strong>Nonprofit pays:</strong> The nonprofit covers the capped platform fee.</li><li><strong>Winning bidder pays:</strong> The capped platform fee is added to the winning bidder’s amount.</li><li><strong>Split:</strong> The nonprofit chooses how to divide the capped platform fee; the two shares always add up to the fee for that item.</li></ul>
  <h2>Example</h2><p>On a $100 eligible winning bid, a 50/50 split allocates $2.50 to the nonprofit’s share and $2.50 to the winning bidder’s share, before separate processing fees and any applicable taxes.</p>
  <h2>Payment processing</h2><p>Payment processing (2.9% + $0.30) is separate from Gather’s capped platform fee and is disclosed before payment.</p>
  <h2>Travel experiences</h2><p>Give Holidays experiences can include supplier cost and Gather travel markup within package pricing. Package-specific pricing and fulfillment terms govern each experience.</p>
  <div className="mt-8 rounded-xl border-l-4 border-[#a79260] bg-[#f8f7f1] p-5 text-sm leading-6">Treatment of refunds, taxes, donations, chargebacks, and special event items remains subject to the final production fee schedule.</div>
  </HelpPolicyLayout>; }

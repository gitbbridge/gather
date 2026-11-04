import { HelpPolicyLayout } from '@/components/help-policy-layout';

export const metadata = { title: 'Fees & Payments | Gather' };
export default function FeesPage() { return <HelpPolicyLayout active="/help/fees" title="Fees & Payments" lede="A transparent 5% platform commission with organizer-controlled allocation.">
  <h2>Gather platform commission</h2><p>Gather charges a <strong>5% platform commission</strong> on eligible auction transactions. The nonprofit chooses how that commission is allocated.</p><ul><li><strong>Nonprofit pays:</strong> The nonprofit covers the full 5%.</li><li><strong>Winning bidder pays:</strong> The 5% is added to the winning bidder’s amount.</li><li><strong>Split:</strong> The nonprofit chooses how to divide the 5%; the combined platform rate remains 5%.</li></ul>
  <h2>Example</h2><p>On a $100 eligible winning bid, a 50/50 split allocates $2.50 to the nonprofit’s share and $2.50 to the winning bidder’s share, before separate processing fees and any applicable taxes.</p>
  <h2>Payment processing</h2><p>Stripe processing fees are separate from Gather’s platform commission and are disclosed before payment.</p>
  <h2>Travel experiences</h2><p>Give Holidays experiences can include supplier cost and Gather travel markup within package pricing. Package-specific pricing and fulfillment terms govern each experience.</p>
  <div className="mt-8 rounded-xl border-l-4 border-[#a79260] bg-[#f8f7f1] p-5 text-sm leading-6">Treatment of refunds, taxes, donations, chargebacks, and special event items remains subject to the final production fee schedule.</div>
  </HelpPolicyLayout>; }

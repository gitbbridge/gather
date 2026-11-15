import { HelpPolicyLayout } from '@/components/help-policy-layout';

export const metadata = { title: 'Fees & Payments | Gather' };
export default function FeesPage() { return <HelpPolicyLayout active="/help/fees" title="Fees & Payments" lede="Gather is 100% free for nonprofit organizers.">
  <h2>No Gather platform fee</h2><p>Gather charges no monthly plan, platform commission, success fee, or percentage of donations, tickets, winning bids, or auction proceeds. The nonprofit and bidder are never asked to allocate or split a Gather fee.</p>
  <h2>Optional supporter contribution</h2><p>At checkout, a supporter may choose to help keep Gather free. The amount is editable, may be $0, and is shown separately from nonprofit proceeds.</p>
  <h2>Payment processing</h2><p>Payment-processor costs are separate, disclosed honestly, and never labeled as Gather fees or marked up by Gather.</p>
  <h2>Travel experiences</h2><p>Give Holidays is optional. Package pricing, supplier cost, travel terms, and fulfillment remain separate from Gather’s free platform promise.</p>
  </HelpPolicyLayout>; }

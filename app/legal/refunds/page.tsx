import { DraftPolicyPage } from '@/components/draft-policy-page';

export const metadata = { title: 'Refunds & Fulfillment | Gather' };
export default function RefundsPage() { return <DraftPolicyPage active="/legal/refunds" title="Refunds & Fulfillment" lede="Who to contact when an item, payment, or experience needs attention.">
  <h2>Non-travel auction items</h2><p>The nonprofit organizer sets and discloses item-specific conditions, including pickup location, deadlines, transferability, and lawful refund restrictions. Contact the organizer first about item condition, description, or pickup.</p>
  <h2>Payment problems</h2><p>For duplicate charges, failed transactions, or an incorrect invoice, contact Gather support. Gather and its processor will investigate the payment record and coordinate with the organizer.</p>
  <h2>Give Holidays packages</h2><p>Travel packages follow the cancellation, booking, validity, transferability, and fulfillment terms shown on the individual experience. Not all packages can be refunded, exchanged, or booked on every date.</p>
  <h2>Fees and refund adjustments</h2><p>Any refund of Gather platform fees, processing charges, taxes, or travel costs follows the final approved fee schedule, package terms, processor rules, and applicable law.</p>
  <h2>Escalating a dispute</h2><p>Include the auction name, item title, transaction reference, and a concise description when contacting support. Never send a payment card number by email.</p>
  </DraftPolicyPage>; }

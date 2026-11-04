import Link from 'next/link';
import { HelpPolicyLayout } from '@/components/help-policy-layout';

export const metadata = { title: 'Contact Support | Gather' };
export default function SupportPage() { return <HelpPolicyLayout active="/support" title="Contact Support" lede="Help for organizers, bidders, and Give Holidays winners.">
  <h2>What do you need help with?</h2><ul><li><strong>Creating an auction:</strong> Organization setup, dates, items, payments, and launch.</li><li><strong>Placing bids:</strong> Account access, bid status, maximum bids, and closing times.</li><li><strong>Payments:</strong> Winner invoices, charges, receipts, and refunds.</li><li><strong>Item pickup:</strong> Contact the nonprofit shown on the auction page.</li><li><strong>Travel experiences:</strong> Review the package terms and the fulfillment details supplied after payment.</li></ul>
  <h2>Request help</h2><p>Email <a href="mailto:support@gatherforgood.bid">support@gatherforgood.bid</a>. Include the auction name, item title when applicable, your account email, and a short explanation. Never send a password or full payment-card details.</p>
  <h2>Helpful links</h2><p><Link href="/help/organizers">Organizer Guide</Link> · <Link href="/help/bidders">Bidder Guide</Link> · <Link href="/help/fees">Fees & Payments</Link> · <Link href="/help/travel">Travel Experiences</Link></p>
  <h2>Availability</h2><p>Support response targets and any auction-day escalation process will be published before live-money auctions are enabled.</p>
  </HelpPolicyLayout>; }

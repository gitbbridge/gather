import { HelpPolicyLayout } from '@/components/help-policy-layout';

export const metadata = { title: 'Organizer Guide | Gather' };
export default function OrganizerGuidePage() { return <HelpPolicyLayout active="/help/organizers" title="Organizer Guide" lede="Set up an online or mobile silent auction one focused step at a time.">
  <h2>Five steps to an auction</h2><ol><li><strong>Organization:</strong> Enter the nonprofit name and primary contact.</li><li><strong>Auction details:</strong> Name the fundraiser, choose its shareable link, and set bidding dates.</li><li><strong>Add items:</strong> Add descriptions, photos, donor details, fair market values, and approved Give Holidays packages.</li><li><strong>Payment & fees:</strong> Choose whether the nonprofit pays Gather’s 5% platform fee, winning bidders pay it, or the fee is split between them. The fee is capped at $100 per item.</li><li><strong>Review & launch:</strong> Preview the auction and publish when every required detail is ready.</li></ol>
  <h2>During the auction</h2><p>Monitor bids and items through the organizer dashboard. Qualifying activity near closing can extend an item by two minutes to discourage bid sniping.</p>
  <h2>When bidding ends</h2><p>Review winners, create combined invoices, track payments, and coordinate item pickup. A Give Holidays fulfillment record begins only after the winning bidder pays.</p>
  <h2>Before you publish</h2><p>Confirm dates, item descriptions, pickup terms, fee allocation, and any restrictions for donated goods or experiences.</p>
  </HelpPolicyLayout>; }

import { HelpPolicyLayout } from '@/components/help-policy-layout';

export const metadata = { title: 'Bidder Guide | Gather' };
export default function BidderGuidePage() { return <HelpPolicyLayout active="/help/bidders" title="Bidder Guide" lede="How to register, bid, win, and pay in a Gather auction.">
  <h2>Browse and register</h2><p>Open the nonprofit’s auction link and browse available items. Create or sign in to your account before placing a bid.</p>
  <h2>Maximum bids</h2><p>Enter a private maximum bid. Gather increases your bid only as needed, up to that maximum, according to the item’s bid increment. Other bidders never see your private maximum.</p>
  <h2>Close of bidding</h2><p>A qualifying bid near the scheduled close can extend the item by two minutes. Check the displayed closing status before assuming bidding has ended.</p>
  <h2>If you win</h2><p>Your winning items appear in My Wins and are combined into an invoice. Review the winning amount, your allocated share of Gather’s capped 5% platform fee, and separately disclosed processing fees before paying.</p>
  <h2>Pickup and fulfillment</h2><p>The nonprofit sets pickup or delivery arrangements for physical items. Paid Give Holidays winners submit traveler details through the claim process and receive booking updates separately.</p>
  </HelpPolicyLayout>; }

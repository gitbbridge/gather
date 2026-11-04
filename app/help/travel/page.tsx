import Link from 'next/link';
import { HelpPolicyLayout } from '@/components/help-policy-layout';

export const metadata = { title: 'Give Holidays Travel Experiences | Gather' };
export default function TravelHelpPage() { return <HelpPolicyLayout active="/help/travel" title="Give Holidays Travel Experiences" lede="Curated travel auction items with clearly stated package terms.">
  <h2>For organizers</h2><p>Review every package’s description, inclusions, restrictions, pricing controls, and fulfillment terms before adding it to an auction. Core travel terms remain locked.</p>
  <h2>For bidders</h2><p>Before bidding, review redemption requirements, booking windows, exclusions, blackout dates, taxes or resort fees, and limitations on transfers or cancellations.</p>
  <h2>How redemption works</h2><ol><li>The package is won and added to the winner’s combined invoice.</li><li>The winner pays through Gather.</li><li>Only after payment succeeds does Gather create a fulfillment obligation.</li><li>The winner submits traveler names and preferred dates.</li><li>Give Holidays confirms availability and booking details.</li></ol>
  <h2>Questions or problems</h2><p>Contact the nonprofit for auction-specific concerns or <Link href="/support">Gather support</Link> for platform and fulfillment assistance.</p>
  </HelpPolicyLayout>; }

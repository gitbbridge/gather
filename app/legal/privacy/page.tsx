import { DraftPolicyPage } from '@/components/draft-policy-page';

export const metadata = { title: 'Privacy Policy | Gather' };
export default function PrivacyPolicyPage() { return <DraftPolicyPage active="/legal/privacy" title="Privacy Policy" lede="How Gather collects, uses, and protects information.">
  <h2>Who operates Gather</h2><p>Gather is an online auction platform for nonprofit organizers and participants. Final publication requires the approved operating entity, mailing address, and privacy contact.</p>
  <h2>Information we collect</h2><p>Depending on the features used, Gather may process names, contact information, login identifiers, organization details, auction item descriptions, bids, donation activity, invoices, transaction status, messages, support requests, and device or usage data. Payment card information is handled by the authorized payment processor rather than stored directly by Gather.</p>
  <h2>Why we use information</h2><p>We use information to operate accounts, administer auctions, record bids, calculate fees, fulfill purchases, support organizers and bidders, prevent fraud and misuse, send transactional notices, and meet legal obligations.</p>
  <h2>Who receives information</h2><p>Information may be shared with the nonprofit running the relevant auction, authorized providers such as payment, hosting, email, and travel fulfillment vendors, and authorities when legally required. An organizer may independently determine how it uses information it receives.</p>
  <h2>Advertising and marketing</h2><p>Any analytics or advertising technologies must be identified from the production configuration. Marketing messages will provide required unsubscribe controls; operational transaction notices may still be sent.</p>
  <h2>Retention and security</h2><p>Information is retained only as long as needed for legitimate operational, contractual, or legal purposes, subject to the final retention schedule. Gather uses reasonable administrative and technical safeguards, but no system can guarantee absolute security.</p>
  <h2>Your choices and rights</h2><p>Users may request access, correction, or deletion of personal information, subject to applicable law and necessary record retention. Final publication requires jurisdiction-specific rights, a verified request channel, appeal procedures, and applicable opt-out links.</p>
  <h2>Children</h2><p>Gather is not intended for children to use independently. The minimum account age and any school-fundraising notices require final legal approval.</p>
  <h2>Changes and contact</h2><p>The policy may be revised as services change. Final publication requires an approved effective date and verified privacy contact.</p>
  </DraftPolicyPage>; }

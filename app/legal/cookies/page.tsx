import { DraftPolicyPage } from '@/components/draft-policy-page';

export const metadata = { title: 'Cookie Policy | Gather' };
export default function CookiePolicyPage() { return <DraftPolicyPage active="/legal/cookies" title="Cookie Policy" lede="How cookies and similar technologies may be used on Gather.">
  <h2>Essential technologies</h2><p>Gather may use necessary cookies or similar storage technologies to maintain sessions, support authentication, preserve security controls, and operate the auction experience.</p>
  <h2>Preferences and measurement</h2><p>Depending on the deployed configuration, Gather may use optional technologies to remember preferences, evaluate website performance, or measure campaign results.</p>
  <h2>Advertising technologies</h2><p>If advertising measurement or other third-party tools are installed, the final policy must identify the providers, describe their functions, and provide legally required consent or opt-out controls before activation.</p>
  <h2>Your controls</h2><p>Browser settings may allow users to restrict cookies, although disabling essential technologies can prevent account or bidding features from functioning. Final publication requires a production cookie inventory, vendor list, duration schedule, and live privacy-choice mechanism.</p>
  <h2>Contact</h2><p>The final version will identify the verified privacy contact.</p>
  </DraftPolicyPage>; }

import { requireAppUser } from '@/lib/auth';
import OnboardingClient from './onboarding-client';
export const dynamic = 'force-dynamic';
export default async function OnboardingPage() { await requireAppUser('/onboarding'); return <OnboardingClient />; }

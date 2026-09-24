import { requireChatGPTUser } from '@/app/chatgpt-auth';
import OnboardingClient from './onboarding-client';
export const dynamic = 'force-dynamic';
export default async function OnboardingPage() { await requireChatGPTUser('/onboarding'); return <OnboardingClient />; }

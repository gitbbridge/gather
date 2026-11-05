import { requireAppUser } from "@/lib/auth";
import OnboardingClient from "./onboarding-client";
import { canCreateOrganization } from "@/lib/auth-destination";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function OnboardingPage() {
  const user = await requireAppUser("/onboarding");
  if (!(await canCreateOrganization(user))) redirect("/account");
  return <OnboardingClient />;
}

import { requireAppUser } from "@/lib/auth";
import DirectOffersClient from "./direct-offers-client";
export const dynamic = "force-dynamic";
export const metadata = { title: "Direct Fundraising Offers | Gather" };
export default async function DirectOffersPage({
  searchParams,
}: {
  searchParams: Promise<{ organization?: string }>;
}) {
  const params = await searchParams;
  await requireAppUser(
    `/admin/direct-offers?organization=${params.organization || ""}`,
  );
  return <DirectOffersClient organizationId={params.organization || ""} />;
}

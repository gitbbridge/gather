import { requireAppUser } from "@/lib/auth";
import SponsorsClient from "./sponsors-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Event sponsors | Gather" };

export default async function SponsorsPage({
  searchParams,
}: {
  searchParams: Promise<{ organization?: string; auction?: string }>;
}) {
  const params = await searchParams;
  await requireAppUser(`/admin/sponsors?organization=${params.organization || ""}&auction=${params.auction || ""}`);
  return <SponsorsClient organizationId={params.organization || ""} auctionId={params.auction || ""} />;
}

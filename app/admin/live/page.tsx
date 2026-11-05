import { requireAppUser } from "@/lib/auth";
import LiveClient from "./live-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gather Live | Gather" };
export default async function LivePage({ searchParams }: { searchParams: Promise<{ auction?: string }> }) {
  const params = await searchParams;
  await requireAppUser(`/admin/live?auction=${params.auction || ""}`);
  return <LiveClient auctionId={params.auction || ""} />;
}

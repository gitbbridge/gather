import { requireAppUser } from "@/lib/auth";
import AuctionsClient from "./auctions-client";

export const dynamic = "force-dynamic";

export default async function PastAuctionsPage() {
  await requireAppUser("/admin/auctions");
  return <AuctionsClient />;
}

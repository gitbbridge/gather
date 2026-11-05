import { requireAppUser } from "@/lib/auth";
import TicketsClient from "./tickets-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tickets | Gather" };

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ organization?: string; auction?: string }>;
}) {
  const params = await searchParams;
  await requireAppUser(
    `/admin/tickets?organization=${params.organization || ""}&auction=${params.auction || ""}`,
  );
  return (
    <TicketsClient
      organizationId={params.organization || ""}
      auctionId={params.auction || ""}
    />
  );
}

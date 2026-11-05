import { notFound } from "next/navigation";
import { database, nonprofitBySlug } from "@/lib/nonprofits";
import TicketsPublicClient from "./tickets-public-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Event Tickets | Gather" };

export default async function EventTicketsPage({
  params,
}: {
  params: Promise<{ slug: string; auctionId: string }>;
}) {
  const { slug, auctionId } = await params;
  const nonprofit = await nonprofitBySlug(slug);
  if (!nonprofit) notFound();
  const event = await database()
    .prepare("SELECT id FROM auctions WHERE id=? AND nonprofit_id=?")
    .bind(auctionId, nonprofit.id)
    .first();
  if (!event) notFound();
  return <TicketsPublicClient auctionId={auctionId} organizationSlug={slug} />;
}

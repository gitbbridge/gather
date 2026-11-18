import { requireAppUser } from "@/lib/auth";
import EmailMarketingClient from "./email-marketing-client";

export const dynamic = "force-dynamic";

export default async function EmailMarketingPage({ searchParams }: { searchParams: Promise<{ organization?: string; auction?: string; view?: string }> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.organization) query.set("organization", params.organization);
  if (params.auction) query.set("auction", params.auction);
  if (params.view) query.set("view", params.view);
  await requireAppUser(`/admin/email-marketing?${query.toString()}`);
  return <EmailMarketingClient organizationId={params.organization || ""} auctionId={params.auction || ""} initialView={params.view || "campaigns"}/>;
}

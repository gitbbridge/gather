import { requireAppUser } from "@/lib/auth";
import CrmClient from "./crm-client";

export const dynamic = "force-dynamic";

export default async function CrmPage({ searchParams }: { searchParams: Promise<{ organization?: string; auction?: string; view?: string }> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.organization) query.set("organization", params.organization);
  if (params.auction) query.set("auction", params.auction);
  if (params.view) query.set("view", params.view);
  await requireAppUser(`/admin/crm?${query.toString()}`);
  return <CrmClient organizationId={params.organization || ""} auctionId={params.auction || ""} initialView={params.view === "opportunities" ? "opportunities" : params.view === "reports" ? "reports" : "contacts"}/>;
}

import { requireAppUser } from "@/lib/auth";
import EmailReceiptsClient from "./email-receipts-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email & Receipts | Gather" };
export default async function EmailReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ organization?: string; verified?: string }>;
}) {
  const params = await searchParams;
  await requireAppUser(
    `/admin/settings/email-receipts?organization=${params.organization || ""}`,
  );
  return (
    <EmailReceiptsClient
      organizationId={params.organization || ""}
      verified={params.verified === "1"}
    />
  );
}

import InvitationExchange from "./invitation-exchange";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sponsor invitation | Gather" };

export default async function SponsorInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InvitationExchange token={token} />;
}

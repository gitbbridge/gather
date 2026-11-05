import ProjectorClient from "./projector-client";
export const dynamic = "force-dynamic";
export const metadata = { title: "Live event | Gather" };
export default async function LiveDisplayPage({ params }: { params: Promise<{ auctionId: string }> }) {
  return <ProjectorClient auctionId={(await params).auctionId} />;
}

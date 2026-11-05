import DirectOfferClient from "./direct-offer-client";
export const dynamic = "force-dynamic";
export const metadata = { title: "Give Holidays Fundraising Offer | Gather" };
export default async function DirectOfferPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <DirectOfferClient slug={slug} />;
}

import AuctionApp from './auction-app';
import { LandingPage } from './landing-page';

export default async function Home({ searchParams }: { searchParams: Promise<{ auction?: string }> }) {
  const { auction } = await searchParams;
  return auction ? <AuctionApp /> : <LandingPage />;
}

import { nonprofitBySlug, database, publicNonprofit } from '@/lib/nonprofits';
import { defaultHomepage, parseHomepage } from '@/lib/homepage';
import type { Auction } from '@/lib/auction';
import { HomepageRenderer } from '@/components/homepage-renderer';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const nonprofit = await nonprofitBySlug(slug);
  if (!nonprofit) return { title: 'Nonprofit not found' };
  return { title: `${nonprofit.name} | Gather`, description: nonprofit.mission, openGraph: { title: nonprofit.name, description: nonprofit.mission, images: [] }, twitter: { title: nonprofit.name, description: nonprofit.mission, images: [] } };
}

export default async function NonprofitPage({ params }: Props) {
  const { slug } = await params;
  const nonprofit = await nonprofitBySlug(slug);
  if (!nonprofit) notFound();
  const rows = (await database().prepare('SELECT id,state FROM auctions WHERE nonprofit_id=? ORDER BY rowid DESC').bind(nonprofit.id).all<{ id: string; state: string }>()).results;
  const auctions = rows.map(row => ({ id: row.id, state: JSON.parse(row.state) as Auction }));
  const homepage = await database().prepare('SELECT published FROM nonprofit_homepages WHERE nonprofit_id=?').bind(nonprofit.id).first<{ published: string | null }>();
  const clock = await database().prepare("SELECT CAST(strftime('%s','now') AS INTEGER)*1000 AS now").first<{ now: number }>();
  const publicFields = publicNonprofit(nonprofit);
  const config = parseHomepage(homepage?.published) || defaultHomepage(publicFields, auctions);
  return <HomepageRenderer nonprofit={publicFields} config={config} auctions={auctions} now={clock?.now || 0}/>;
}

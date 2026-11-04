import { requireAppUser } from '@/lib/auth';
import HomepageBuilder from './homepage-builder';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Auction Page Builder | Gather', description: 'Create and publish your nonprofit auction page.' };
export default async function HomepageBuilderPage() { await requireAppUser('/homepage'); return <HomepageBuilder/>; }

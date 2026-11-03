import { requireAppUser } from '@/lib/auth';
import HomepageBuilder from './homepage-builder';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Homepage Builder | Gather', description: 'Create and publish your nonprofit homepage.' };
export default async function HomepageBuilderPage() { await requireAppUser('/homepage'); return <HomepageBuilder/>; }

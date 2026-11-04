import { requireAppUser } from '@/lib/auth';
import MyWinsClient from './my-wins-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Wins | Gather' };

export default async function MyWinsPage() {
  await requireAppUser('/my-wins');
  return <MyWinsClient/>;
}

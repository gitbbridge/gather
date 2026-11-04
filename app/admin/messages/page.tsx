import { requireAppUser } from '@/lib/auth';
import MessagesClient from './messages-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Gather Messages' };

export default async function MessagesPage() {
  await requireAppUser('/admin/messages');
  return <MessagesClient/>;
}

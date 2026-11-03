import { requireAppUser } from '@/lib/auth';
import CloseoutClient from './closeout-client';
export const dynamic='force-dynamic';
export const metadata={title:'Closeout | Gather',description:'Review, reconcile, follow up, and export your auction closeout.'};
export default async function CloseoutPage(){await requireAppUser('/closeout');return <CloseoutClient/>;}

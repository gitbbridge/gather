import { requireChatGPTUser } from '@/app/chatgpt-auth';
import CloseoutClient from './closeout-client';
export const dynamic='force-dynamic';
export const metadata={title:'Closeout | Gather',description:'Review, reconcile, follow up, and export your auction closeout.'};
export default async function CloseoutPage(){await requireChatGPTUser('/closeout');return <CloseoutClient/>;}

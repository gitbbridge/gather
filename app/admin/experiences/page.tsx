import {requireAppUser} from '@/lib/auth';
import ExperiencesClient from './experiences-client';
import {GatherAssistant} from '@/components/gather-assistant';

export const dynamic='force-dynamic';
export const metadata={title:'Give Holidays Experiences | Gather'};
export default async function ExperiencesPage(){await requireAppUser('/admin/experiences');return <><ExperiencesClient/><GatherAssistant audience="organizer" surface="travel"/></>}

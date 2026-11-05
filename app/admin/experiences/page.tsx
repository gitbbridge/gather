import {requireAppUser} from '@/lib/auth';
import ExperiencesClient from './experiences-client';

export const dynamic='force-dynamic';
export const metadata={title:'Give Holidays Experiences | Gather'};
export default async function ExperiencesPage(){await requireAppUser('/admin/experiences');return <ExperiencesClient/>}

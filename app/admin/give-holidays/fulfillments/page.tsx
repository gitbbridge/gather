import {Leaf,LockKeyhole} from 'lucide-react';
import {requireAppUser} from '@/lib/auth';
import {isPlatformAdmin} from '@/lib/platform-admin';
import FulfillmentClient from './fulfillment-client';

export const dynamic='force-dynamic';
export default async function FulfillmentsPage(){const user=await requireAppUser('/admin/give-holidays/fulfillments');if(!isPlatformAdmin(user))return <main className="grid min-h-screen place-items-center bg-[#f8faf9] p-6"><div className="max-w-lg rounded-2xl border bg-white p-8"><LockKeyhole/><h1 className="mt-4 text-2xl font-semibold">Platform admin access required</h1><a className="mt-5 inline-flex text-[#175b47]" href="/admin">Return to dashboard</a></div></main>;return <FulfillmentClient/>}

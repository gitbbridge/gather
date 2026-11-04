import {getAppUser} from '@/lib/auth';
import {isPlatformAdmin} from '@/lib/platform-admin';
import {supabaseEmailConfig} from '@/lib/email/templates';

export const dynamic='force-dynamic';
export async function GET(){if(!isPlatformAdmin(await getAppUser()))return Response.json({error:'Platform administrator access required.'},{status:403});return new Response(JSON.stringify(supabaseEmailConfig(),null,2),{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="gather-supabase-email-config.json"','Cache-Control':'private, no-store'}})}

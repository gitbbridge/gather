import {supabaseEmailConfig} from '@/lib/email/templates';
import {platformSecurityAccess,privilegedAccessError} from '@/lib/security/privileged-access';

export const dynamic='force-dynamic';
export async function GET(){if(!(await platformSecurityAccess()).allowed)return privilegedAccessError();return new Response(JSON.stringify(supabaseEmailConfig(),null,2),{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="gather-supabase-email-config.json"','Cache-Control':'private, no-store'}})}

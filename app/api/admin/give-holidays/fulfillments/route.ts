import {z} from 'zod';
import {getAppUser} from '@/lib/auth';
import {isPlatformAdmin} from '@/lib/platform-admin';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';

export const dynamic='force-dynamic';
const update=z.object({id:z.string().uuid(),status:z.enum(['paid_details_needed','traveler_details_submitted','dates_requested','booking_in_progress','confirmed','fulfilled','cancelled','refunded']),providerReference:z.string().trim().max(200).optional()});
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function allowed(){return isPlatformAdmin(await getAppUser())}

export async function GET(){try{if(!await allowed())return json({error:'Platform administrator access required.'},403);const {data,error}=await createSupabaseAdminClient().from('fulfillments').select(`id,status,provider_reference,created_at,updated_at,winner_invoice_items(hammer_price_cents,auction_items(title,travel_package_snapshot),winner_invoices(payer_id,paid_at,auctions(name))),traveler_claims(traveler_details,preferred_dates,submitted_at)`).eq('fulfillment_type','give_holidays').order('created_at',{ascending:false});if(error)throw error;return json({fulfillments:data||[]})}catch(error){console.error(error);return json({error:'Unable to load fulfillment queue.'},500)}}
export async function PATCH(request:Request){try{if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);if(!await allowed())return json({error:'Platform administrator access required.'},403);const parsed=update.safeParse(await request.json());if(!parsed.success)return json({error:'Choose a valid fulfillment status.'},400);const {id,status,providerReference}=parsed.data;const {error}=await createSupabaseAdminClient().from('fulfillments').update({status,provider_reference:providerReference||null,fulfilled_at:status==='fulfilled'?new Date().toISOString():null}).eq('id',id).eq('fulfillment_type','give_holidays');if(error)throw error;return json({ok:true})}catch(error){console.error(error);return json({error:'Unable to update fulfillment.'},500)}}

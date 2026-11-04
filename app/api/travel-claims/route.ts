import {z} from 'zod';
import {getAppUser} from '@/lib/auth';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';

export const dynamic='force-dynamic';
const input=z.object({fulfillmentId:z.string().uuid(),travelerNames:z.array(z.string().trim().min(2).max(100)).min(1).max(12),preferredDates:z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(6),contactPhone:z.string().trim().max(40).optional(),notes:z.string().trim().max(2000).optional()});
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});

export async function POST(request:Request){
 try{
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);
  const user=await getAppUser();if(!user)return json({error:'Sign in to claim your experience.'},401);
  const parsed=input.safeParse(await request.json());if(!parsed.success)return json({error:'Add traveler names and at least one preferred date.'},400);
  const client=createSupabaseAdminClient();
  const {data:fulfillment,error}=await client.from('fulfillments').select('id,status,fulfillment_type,winner_invoice_items(invoice_id,winner_invoices(payer_id,status))').eq('id',parsed.data.fulfillmentId).single();
  if(error||!fulfillment)return json({error:'Travel fulfillment not found.'},404);
  const line=Array.isArray(fulfillment.winner_invoice_items)?fulfillment.winner_invoice_items[0]:fulfillment.winner_invoice_items;
  const invoice=Array.isArray(line?.winner_invoices)?line.winner_invoices[0]:line?.winner_invoices;
  if(invoice?.payer_id!==user.userId)return json({error:'Access denied.'},403);
  if(invoice?.status!=='paid'||fulfillment.fulfillment_type!=='give_holidays')return json({error:'This experience can be claimed after payment is confirmed.'},409);
  if(['cancelled','refunded','fulfilled'].includes(fulfillment.status))return json({error:'This experience can no longer be changed online.'},409);
  const claim={fulfillment_id:fulfillment.id,winner_id:user.userId,traveler_details:{names:parsed.data.travelerNames,contactEmail:user.email,contactPhone:parsed.data.contactPhone||'',notes:parsed.data.notes||''},preferred_dates:parsed.data.preferredDates,submitted_at:new Date().toISOString()};
  const {error:claimError}=await client.from('traveler_claims').upsert(claim,{onConflict:'fulfillment_id'});if(claimError)throw claimError;
  const {error:statusError}=await client.from('fulfillments').update({status:'traveler_details_submitted'}).eq('id',fulfillment.id);if(statusError)throw statusError;
  return json({ok:true,status:'traveler_details_submitted'});
 }catch(error){console.error('Unable to submit travel claim:',error);return json({error:'Unable to submit traveler details. Please try again.'},500);}
}

import { getAppUser } from '@/lib/auth';
import { database,nonprofitById,nonprofitBySlug,nonprofitInsert,publicNonprofit } from '@/lib/nonprofits';
import { z } from 'zod';
export const dynamic='force-dynamic';
const form=z.discriminatedUnion('action',[
 z.object({action:z.literal('setup'),auctionId:z.string().min(1).max(100)}),
 z.object({action:z.literal('branding'),id:z.string().max(100),name:z.string().trim().min(2).max(100),headline:z.string().trim().min(5).max(140),mission:z.string().trim().min(20).max(2000),accent:z.enum(['#175b47','#264d7e','#763e62','#8b431e'])}),
 z.object({action:z.literal('join'),slug:z.string().max(80),name:z.string().trim().min(2).max(100),auctionId:z.string().min(1).max(100),item:z.string().max(100).optional()}),
]);
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:Request){try{
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Invalid origin.'},403);
 const user=await getAppUser();if(!user)return json({error:'Sign in to register.'},401);
 const raw=await req.text();if(raw.length>12000)return json({error:'Request too large.'},413);
 const parsed=form.safeParse(JSON.parse(raw));if(!parsed.success)return json({error:'Please complete all fields.'},400);const x=parsed.data;const db=database();
 if(x.action==='setup'){
 const auction=await db.prepare('SELECT owner,state,nonprofit_id FROM auctions WHERE id=?').bind(x.auctionId).first<{owner:string;state:string;nonprofit_id:string|null}>();
 if(!auction||auction.owner!==user.userId)return json({error:'Only the organizer can create this page.'},403);
 if(!auction.nonprofit_id){const name=JSON.parse(auction.state).organization;await db.batch([nonprofitInsert(x.auctionId,user.userId,name),db.prepare('UPDATE auctions SET nonprofit_id=? WHERE id=? AND owner=? AND nonprofit_id IS NULL').bind(x.auctionId,x.auctionId,user.userId)]);}
 return json({nonprofit:publicNonprofit((await nonprofitById(auction.nonprofit_id||x.auctionId))!)});
 }
 if(x.action==='branding'){
 const result=await db.prepare('UPDATE nonprofits SET name=?,headline=?,mission=?,accent=? WHERE id=? AND owner=?').bind(x.name,x.headline,x.mission,x.accent,x.id,user.userId).run();
 if(!result.meta.changes)return json({error:'Only the organizer can edit this page.'},403);
 return json({nonprofit:publicNonprofit((await nonprofitById(x.id))!)});
 }
 const n=await nonprofitBySlug(x.slug);if(!n)return json({error:'Nonprofit not found.'},404);
 const auction=await db.prepare('SELECT id FROM auctions WHERE id=? AND nonprofit_id=?').bind(x.auctionId,n.id).first();if(!auction)return json({error:'Auction not found for this nonprofit.'},404);
 await db.prepare('INSERT INTO registrations (nonprofit_id,user_id,name,email,created_at) VALUES (?,?,?,?,?) ON CONFLICT(nonprofit_id,user_id) DO NOTHING').bind(n.id,user.userId,x.name,user.email,Date.now()).run();
 const destination=`/n/${n.slug}/auction/${x.auctionId}`+(x.item?'?item='+encodeURIComponent(x.item):'');return json({destination});
 }catch(e){console.error(e);return json({error:'Unable to save. Please try again.'},500);}}

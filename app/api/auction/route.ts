import { env } from 'cloudflare:workers';
import { getAppUser } from '@/lib/auth';
import { Auction,bid,createAuction,publicState } from '@/lib/auction';
import { z } from 'zod';
import { nonprofitById,nonprofitInsert,isRegistered,publicNonprofit } from '@/lib/nonprofits';
export const dynamic='force-dynamic';
const starterItem=z.object({title:z.string().trim().min(1).max(100),value:z.number().int().min(0).max(100000000),source:z.enum(['custom','give-holidays']).optional()});
const input=z.object({action:z.enum(['create','bid','watch','donate','buy','settings','item']),id:z.string().max(100).optional(),item:z.string().max(100).optional(),amount:z.number().int().positive().max(100000000).optional(),key:z.string().uuid(),name:z.string().trim().min(2).max(100).optional(),organization:z.string().trim().min(2).max(100).optional(),nonprofitSlug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(48).optional(),nonprofitId:z.string().max(100).optional(),paused:z.boolean().optional(),title:z.string().trim().min(3).max(100).optional(),category:z.enum(['Getaways','Food & drink','Art & home','Wellness','Experiences']).optional(),description:z.string().trim().min(10).max(2000).optional(),donor:z.string().trim().min(2).max(100).optional(),start:z.number().int().min(100).max(100000000).optional(),value:z.number().int().min(100).max(100000000).optional(),openDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),closeDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),commissionPayer:z.enum(['organizer','split','bidder']).optional(),organizerShare:z.number().int().min(0).max(100).optional(),items:z.array(starterItem).max(25).optional()});
function db(){if(!env.DB)throw Error('Database unavailable');return env.DB;}
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:Request){try{const user=await getAppUser();const id=new URL(req.url).searchParams.get('id');const now=Date.now();const list=user?(await db().prepare('SELECT id,state FROM auctions WHERE owner=? ORDER BY rowid DESC').bind(user.userId).all<{id:string;state:string}>()).results.map(r=>{const state=JSON.parse(r.state) as Auction;const view=publicState(state,user.userId,true);return {id:r.id,name:state.name,organization:state.organization,starts:state.starts,ends:state.ends,paused:state.paused,items:state.items.length,bids:state.items.reduce((sum,item)=>sum+item.bids.length,0),total:view.total,status:state.ends<=now?'closed':state.starts>now?'scheduled':state.paused?'paused':'open'};}):[];
 const row=id?await db().prepare('SELECT * FROM auctions WHERE id=?').bind(id).first<{id:string;owner:string;state:string;nonprofit_id:string|null}>():list.length?await db().prepare('SELECT * FROM auctions WHERE id=?').bind(list[0].id).first<{id:string;owner:string;state:string;nonprofit_id:string|null}>():null;
 if(id&&id!=='preview'&&!row)return json({error:'Auction not found.'},404);
 const nonprofit=row?.nonprofit_id?await nonprofitById(row.nonprofit_id):null;
 const registered=!!user&&!!nonprofit&&(nonprofit.owner===user.userId||await isRegistered(nonprofit.id,user.userId));
 return json({nonprofit:nonprofit?publicNonprofit(nonprofit):null,registered,user:user?{name:user.displayName}:null,list,id:row?.id,owner:!!user&&row?.owner===user.userId,state:publicState(row?JSON.parse(row.state):createAuction(),user?.userId||'',!!user&&row?.owner===user.userId),demo:!row});}catch(e){console.error(e);return json({error:'Unable to load the auction. Please try again.'},503);}}
export async function POST(req:Request){try{
 const origin=req.headers.get('origin');if(!origin||origin!==new URL(req.url).origin)return json({error:'Invalid request origin.'},403);
 const user=await getAppUser();if(!user)return json({error:'Sign in to continue.'},401);
 if(Number(req.headers.get('content-length')||0)>16000)return json({error:'Request too large.'},413);
 const raw=await req.text();if(raw.length>16000)return json({error:'Request too large.'},413);
 const parsed=input.safeParse(JSON.parse(raw));if(!parsed.success)return json({error:'Check the information and try again.'},400);const x=parsed.data;
 if(x.action==='create'){const id=x.key;const count=await db().prepare('SELECT count(*) AS n FROM auctions WHERE owner=?').bind(user.userId).first<{n:number}>();if((count?.n||0)>=20)return json({error:'The test workspace supports up to 20 auctions.'},400);let nonprofitId=id;let organization=x.organization;
 if(x.nonprofitId){const n=await nonprofitById(x.nonprofitId);if(!n||n.owner!==user.userId)return json({error:'Only the nonprofit organizer can add an auction.'},403);nonprofitId=n.id;organization=n.name;}
 if(!x.nonprofitId&&x.nonprofitSlug&&await db().prepare('SELECT id FROM nonprofits WHERE slug=?').bind(x.nonprofitSlug).first())return json({error:'That nonprofit page address is already in use.'},409);
 const writes=[];if(!x.nonprofitId)writes.push(nonprofitInsert(id,user.userId,organization||'My nonprofit',x.nonprofitSlug));
 const starts=x.openDate?new Date(`${x.openDate}T00:00:00`).getTime():undefined;const ends=x.closeDate?new Date(`${x.closeDate}T23:59:59`).getTime():undefined;
 if(starts&&ends&&ends<=starts)return json({error:'The closing date must be after the opening date.'},400);
 const organizerPercent=x.commissionPayer==='bidder'?0:x.commissionPayer==='split'?x.organizerShare??50:100;
 writes.push(db().prepare('INSERT INTO auctions (id,owner,state,version,nonprofit_id) VALUES (?,?,?,0,?) ON CONFLICT(id) DO NOTHING').bind(id,user.userId,JSON.stringify(createAuction(x.name,organization,{starts,ends,organizerPercent,items:x.items})),nonprofitId));await db().batch(writes);return json({id});}
 if(!x.id)return json({error:'Choose an auction first.'},400);
 for(let attempt=0;attempt<5;attempt++){
 const row=await db().prepare('SELECT * FROM auctions WHERE id=?').bind(x.id).first<{owner:string;state:string;version:number;nonprofit_id:string|null}>();if(!row)return json({error:'Auction not found.'},404);const a:Auction=JSON.parse(row.state);const uid=user.userId;const now=Date.now();if(a.requests.includes(uid+':'+x.key))return json({ok:true});
 const item=a.items.find(i=>i.id===x.item);const owner=row.owner===uid;
 if(x.action==='bid'&&!owner){if(!row.nonprofit_id)return json({error:'The organizer has not enabled bidder registration yet.'},409);if(!await isRegistered(row.nonprofit_id,uid)){const n=await nonprofitById(row.nonprofit_id);return json({error:'Register with this nonprofit to place a bid.',registerUrl:`/n/${n!.slug}/join?auction=${encodeURIComponent(x.id)}&item=${encodeURIComponent(x.item||'')}`},403);}}
 
 if(['settings','item'].includes(x.action)&&!owner)return json({error:'Only the organizer can do this.'},403);
 if(['bid','buy','donate'].includes(x.action)&&a.paused)return json({error:'The organizer has paused this auction.'},409);
 if(['bid','buy','watch'].includes(x.action)&&!item)return json({error:'Item not found.'},404);
 if(x.action==='bid'){const previous=item!.leader;bid(item!,uid,x.amount||0,now);if(previous&&previous!==item!.leader)a.notifications.push({user:previous,message:`You have been outbid on ${item!.title}.`,at:now});if(item!.leader!==uid)a.notifications.push({user:uid,message:`Another bidder has a higher maximum on ${item!.title}.`,at:now});}
 if(x.action==='watch'){const w=a.watches[uid]||[];a.watches[uid]=w.includes(x.item!)?w.filter(v=>v!==x.item):[...w,x.item!];}
 if(x.action==='donate'){if(now>=a.ends)throw Error('Donations for this auction are closed.');if(!x.amount)throw Error('Enter a donation amount.');a.donations.push({user:uid,amount:x.amount,at:now});}
 if(x.action==='buy'){if(!item!.buyNow||item!.sold||now>=item!.ends)throw Error('This item is no longer available to buy.');item!.sold=true;item!.leader=uid;item!.price=item!.buyNow;a.orders.push({id:x.key,user:uid,item:item!.title,amount:item!.buyNow,at:now});}
 if(x.action==='settings'){if(x.name)a.name=x.name;if(x.organization)a.organization=x.organization;if(x.paused!==undefined)a.paused=x.paused;}
 if(x.action==='item'){if(!x.title||!x.description||!x.donor||!x.start||!x.value||!x.category)throw Error('Complete every item field.');if(a.items.length>=200)throw Error('The test workspace supports 200 items.');a.items.push({id:crypto.randomUUID(),title:x.title,description:x.description,donor:x.donor,category:x.category,start:x.start,value:x.value,increment:500,buyNow:0,price:x.start,image:'',leader:'',bids:[],sold:false,ends:a.ends});}
 a.requests.push(uid+':'+x.key);if(a.requests.length>10000)throw Error('This test auction has reached its activity limit.');const state=JSON.stringify(a);if(state.length>900000)throw Error('This test auction has reached its storage limit.');
 const result=await db().prepare('UPDATE auctions SET state=?,version=version+1 WHERE id=? AND version=?').bind(state,x.id,row.version).run();if(result.meta.changes)return json({ok:true});
 }return json({error:'Another bid arrived. Refresh and try again.'},409);
 }catch(e){if(e instanceof SyntaxError)return json({error:'Invalid request.'},400);console.error(e);return json({error:e instanceof Error&& !/SQL|D1|database|binding/i.test(e.message)?e.message:'Unable to save. Please try again.'},400);}}

export type Bid = {user:string; max:number; at:number};
export type Item = {id:string; title:string; category:string; description:string; donor:string; image:string; value:number; start:number; increment:number; buyNow:number; price:number; leader:string; bids:Bid[]; sold:boolean; ends:number; source?:'custom'|'give-holidays'; giveHolidaysPackageCode?:string};
export type FeePolicy = {
 platformRateBps:500;
 organizerPercent:number;
 bidderPercent:number;
 paymentProcessingFeesSeparate:true;
 giveHolidaysMarkupSeparate:true;
};
export type Auction = {name:string; organization:string; goal:number; starts:number; ends:number; paused:boolean; feePolicy:FeePolicy; items:Item[]; watches:Record<string,string[]>; donations:{user:string; amount:number; at:number}[]; orders:{id:string; user:string; item:string; amount:number; at:number}[]; notifications:{user:string; message:string; at:number}[]; requests:string[]};
type AuctionOptions = {starts?:number;ends?:number;organizerPercent?:number;items?:{title:string;value:number;source?:'custom'|'give-holidays';packageCode?:string}[]};
export const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n/100);
export function bid(item:Item,user:string,amount:number,now:number) {
 if(item.sold||now>=item.ends) throw Error('This item is no longer accepting bids.');
 const existing=item.bids.find(b=>b.user===user);
 const minimum=item.leader===user ? (existing?.max||item.price)+item.increment : item.bids.length ? item.price+item.increment : item.start;
 if(!Number.isSafeInteger(amount)||amount<minimum||amount>100000000) throw Error(`Enter a maximum bid of at least ${money(minimum)}.`);
 if(existing) existing.max=amount; else item.bids.push({user,max:amount,at:now});
 item.bids.sort((a,b)=>b.max-a.max||a.at-b.at);
 item.leader=item.bids[0].user;
 item.price=item.bids.length===1?item.start:Math.min(item.bids[0].max,item.bids[1].max+item.increment);
 // Extend by two minutes when a bid arrives in the final two minutes.
 if(item.ends-now<120000) item.ends=now+120000;
}
export function createAuction(name='A brighter future',organization='The Good Neighbor Foundation',options:AuctionOptions={}):Auction {
 const starts=options.starts||Date.now();
 const ends=options.ends||Date.now()+7*86400000;
 const organizerPercent=Math.min(100,Math.max(0,options.organizerPercent??100));
 const rows=[['Mountain cabin escape','Getaways','Two nights in a peaceful mountain cabin for two. Dates are subject to availability; transportation is not included.','Summit Stays',65000,20000,2500,0],['An evening at the chef’s table','Food & drink','A seasonal five-course tasting menu for four guests. Dietary needs can be arranged in advance.','The Common Table',48000,12500,2500,0],['Handcrafted ceramic collection','Art & home','A collection of four handmade ceramic pieces from a local studio. Pickup at the event.','Clay & Co.',24000,7500,1000,30000],['A day to unwind','Wellness','A restorative spa experience for two, including a massage and access to the relaxation lounge.','Stillwater Spa',40000,10000,2500,50000]];
 const items=options.items===undefined
  ? rows.map((r,i)=>({id:crypto.randomUUID(),title:r[0] as string,category:r[1] as string,description:r[2] as string,donor:r[3] as string,image:'/auction-'+i+'.jpg',value:r[4] as number,start:r[5] as number,increment:r[6] as number,buyNow:r[7] as number,price:r[5] as number,leader:'',bids:[],sold:false,ends,source:'custom' as const}))
  : options.items.map(item=>{const travel=item.source==='give-holidays';const start=Math.max(100,Math.round(item.value*.3));return {id:crypto.randomUUID(),title:item.title,category:travel?'Getaways':'Experiences',description:travel?'Give Holidays travel package. Final inclusions, restrictions, availability, and package pricing must be confirmed before publication.':'Details coming soon.',donor:travel?'Give Holidays':organization,image:'',value:item.value,start,increment:500,buyNow:0,price:start,leader:'',bids:[],sold:false,ends,source:item.source||'custom',giveHolidaysPackageCode:item.packageCode};});
 return {name,organization,goal:2500000,starts,ends,paused:false,feePolicy:{platformRateBps:500,organizerPercent,bidderPercent:100-organizerPercent,paymentProcessingFeesSeparate:true,giveHolidaysMarkupSeparate:true},items,watches:{},donations:[],orders:[],notifications:[],requests:[]};
}
export function publicState(a:Auction,user:string,owner:boolean){const feePolicy=a.feePolicy||{platformRateBps:500,organizerPercent:100,bidderPercent:0,paymentProcessingFeesSeparate:true,giveHolidaysMarkupSeparate:true};return {...a,starts:a.starts||Date.now(),feePolicy,requests:undefined,watches:a.watches[user]||[],donations:a.donations.filter(d=>owner||d.user===user).map(d=>({...d,user:undefined})),orders:a.orders.filter(o=>owner||o.user===user).map(o=>({...o,user:undefined})),notifications:a.notifications.filter(n=>n.user===user).slice(-30).reverse().map(n=>({...n,user:undefined})),items:a.items.map(i=>({...i,bids:undefined,bidCount:i.bids.length,leader:undefined,leading:!!user&&i.leader===user,myMax:i.bids.find(b=>b.user===user)?.max||0})),total:a.items.reduce((s,i)=>s+(i.bids.length||i.sold?i.price:0),0)+a.donations.reduce((s,d)=>s+d.amount,0),bidCount:a.items.reduce((s,i)=>s+i.bids.length,0),supporters:new Set([...a.items.flatMap(i=>i.bids.map(b=>b.user)),...a.donations.map(d=>d.user)]).size};}


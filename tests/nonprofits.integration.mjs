import assert from 'node:assert/strict';
import { integrationOrigin as origin, stagingSession } from './helpers/staging-session.mjs';
const ownerCookie=await stagingSession(process.env.STAGING_ORGANIZER_EMAIL||'nonprofit@giveholidays.com',{accountType:'organizer'});
const cookie=await stagingSession(process.env.STAGING_BIDDER_EMAIL||'bidder@giveholidays.com',{accountType:'supporter'});
const isoDate=offset=>new Date(Date.now()+offset*86_400_000).toISOString().slice(0,10);
async function post(path,body,auth=true){const sessionCookie=typeof auth==='string'?auth:auth?cookie:'';const request=()=>fetch(origin+path,{method:'POST',headers:{origin,'Content-Type':'application/json',...(sessionCookie?{cookie:sessionCookie}:{})},body:JSON.stringify(body)});let r=await request();let text=await r.text();if(r.status===503&&text.includes('worker restarted mid-request')){r=await request();text=await r.text();}let data;try{data=JSON.parse(text)}catch{data={error:text}}return {status:r.status,data};}
async function create(name,nonprofitSlug){const r=await post('/api/auction',{action:'create',key:crypto.randomUUID(),name:name+' auction',organization:name,openDate:isoDate(-1),closeDate:isoDate(7),...(nonprofitSlug?{nonprofitSlug}:{})},ownerCookie);assert.equal(r.status,200,JSON.stringify(r.data));return r.data.id;}
async function state(id,auth=false){return (await fetch(origin+'/api/auction?id='+id,{headers:auth?{cookie}:{}})).json();}
const chosenSlug='neighborhood-learning-'+crypto.randomUUID().slice(0,8);const a=await create('Neighborhood Learning Fund',chosenSlug);const b=await create('Community Garden Fund');
const da=await state(a),db=await state(b);assert.notEqual(da.nonprofit.slug,db.nonprofit.slug);assert.equal(da.user,null);assert.equal(da.state.items.length,4);assert.ok(!JSON.stringify(da).includes('local_seedy'));
assert.equal(da.nonprofit.slug,chosenSlug);
for(const d of [da,db]){const r=await fetch(origin+'/n/'+d.nonprofit.slug);assert.equal(r.status,200);const html=await r.text();assert.ok(html.includes(d.nonprofit.name));assert.ok(html.includes('No account needed to browse'));assert.ok(html.includes('property="og:title"'));assert.ok(!html.includes('/og.png'));const catalog=await fetch(origin+`/n/${d.nonprofit.slug}/auction/${d.id}`);assert.equal(catalog.status,200);}
assert.equal((await fetch(origin+`/n/${da.nonprofit.slug}/auction/${b}`)).status,404);
const itemId=da.state.items[0].id;
const bid=id=>({action:'bid',id,item:itemId,amount:30000,key:crypto.randomUUID()});
assert.equal((await post('/api/auction',bid(a),false)).status,401);
const blocked=await post('/api/auction',bid(a));assert.equal(blocked.status,403,JSON.stringify(blocked.data));assert.ok(blocked.data.registerUrl.includes('/join?'));
assert.equal((await post('/api/nonprofit',{action:'join',slug:da.nonprofit.slug,auctionId:b,name:'Test Bidder'})).status,404);
const join={action:'join',slug:da.nonprofit.slug,auctionId:a,item:itemId,name:'Test Bidder'};
for(let i=0;i<2;i++){const r=await post('/api/nonprofit',join);assert.equal(r.status,200);assert.equal(r.data.destination,`/n/${da.nonprofit.slug}/auction/${a}?item=${itemId}`);}
assert.equal((await post('/api/auction',bid(a))).status,200);
assert.equal((await post('/api/auction',bid(b))).status,403);
assert.equal((await post('/api/nonprofit',{action:'branding',id:a,name:'Attack',headline:'Cannot change this',mission:'Should not be able to change another nonprofit.',accent:'#175b47'})).status,403);
const publicAfter=await state(a);assert.equal(publicAfter.state.items[0].myMax,0);assert.equal(publicAfter.registered,false);assert.equal((await state(a,true)).registered,true);
const joinAnon=await fetch(origin+`/n/${da.nonprofit.slug}/join?auction=${a}&item=101`);assert.equal(joinAnon.status,200);const html=await joinAnon.text();assert.ok(html.includes('Continue with email'));assert.ok(html.includes('return_to='));
console.log('PASS: two independent nonprofit pages, anonymous catalog access, page metadata, cross-tenant URL isolation, anonymous and unregistered bid rejection, tenant-scoped registration, duplicate registration, return to item, bid after registration, owner-only branding, private maximum protection.');

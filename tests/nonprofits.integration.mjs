import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const origin='http://localhost:5173';
const signed=await fetch(origin+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=signed.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
async function post(path,body,auth=true){const r=await fetch(origin+path,{method:'POST',headers:{origin,'Content-Type':'application/json',...(auth?{cookie}:{})},body:JSON.stringify(body)});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data={error:text}}return {status:r.status,data};}
async function create(name,nonprofitSlug){const r=await post('/api/auction',{action:'create',key:crypto.randomUUID(),name:name+' auction',organization:name,...(nonprofitSlug?{nonprofitSlug}:{})});assert.equal(r.status,200,JSON.stringify(r.data));return r.data.id;}
async function state(id,auth=false){return (await fetch(origin+'/api/auction?id='+id,{headers:auth?{cookie}:{}})).json();}
const chosenSlug='neighborhood-learning-'+crypto.randomUUID().slice(0,8);const a=await create('Neighborhood Learning Fund',chosenSlug);const b=await create('Community Garden Fund');
const da=await state(a),db=await state(b);assert.notEqual(da.nonprofit.slug,db.nonprofit.slug);assert.equal(da.user,null);assert.equal(da.state.items.length,4);assert.ok(!JSON.stringify(da).includes('local_seedy'));
assert.equal(da.nonprofit.slug,chosenSlug);
for(const d of [da,db]){const r=await fetch(origin+'/n/'+d.nonprofit.slug);assert.equal(r.status,200);const html=await r.text();assert.ok(html.includes(d.nonprofit.name));assert.ok(html.includes('No account needed to browse'));assert.ok(html.includes('property="og:title"'));assert.ok(!html.includes('/og.png'));const catalog=await fetch(origin+`/n/${d.nonprofit.slug}/auction/${d.id}`);assert.equal(catalog.status,200);}
assert.equal((await fetch(origin+`/n/${da.nonprofit.slug}/auction/${b}`)).status,404);
// Only new, disposable fixtures are reassigned to simulate a different organizer.
const sql=`UPDATE auctions SET owner='integration_other_owner' WHERE id IN ('${a}','${b}'); UPDATE nonprofits SET owner='integration_other_owner' WHERE id IN ('${a}','${b}');`;
execFileSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--command',sql],{stdio:'pipe'});
const bid=id=>({action:'bid',id,item:'101',amount:30000,key:crypto.randomUUID()});
assert.equal((await post('/api/auction',bid(a),false)).status,401);
const blocked=await post('/api/auction',bid(a));assert.equal(blocked.status,403);assert.ok(blocked.data.registerUrl.includes('/join?'));
assert.equal((await post('/api/nonprofit',{action:'join',slug:da.nonprofit.slug,auctionId:b,name:'Test Bidder'})).status,404);
const join={action:'join',slug:da.nonprofit.slug,auctionId:a,item:'101',name:'Test Bidder'};
for(let i=0;i<2;i++){const r=await post('/api/nonprofit',join);assert.equal(r.status,200);assert.equal(r.data.destination,`/n/${da.nonprofit.slug}/auction/${a}?item=101`);}
assert.equal((await post('/api/auction',bid(a))).status,200);
assert.equal((await post('/api/auction',bid(b))).status,403);
assert.equal((await post('/api/nonprofit',{action:'branding',id:a,name:'Attack',headline:'Cannot change this',mission:'Should not be able to change another nonprofit.',accent:'#175b47'})).status,403);
const publicAfter=await state(a);assert.equal(publicAfter.state.items[0].myMax,0);assert.equal(publicAfter.registered,false);assert.equal((await state(a,true)).registered,true);
const joinAnon=await fetch(origin+`/n/${da.nonprofit.slug}/join?auction=${a}&item=101`);assert.equal(joinAnon.status,200);const html=await joinAnon.text();assert.ok(html.includes('Continue with email'));assert.ok(html.includes('return_to='));
console.log('PASS: two independent nonprofit pages, anonymous catalog access, page metadata, cross-tenant URL isolation, anonymous and unregistered bid rejection, tenant-scoped registration, duplicate registration, return to item, bid after registration, owner-only branding, private maximum protection.');

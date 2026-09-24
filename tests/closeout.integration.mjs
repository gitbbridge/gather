import assert from 'node:assert/strict';

const origin = 'http://localhost:5173';
const signed = await fetch(origin + '/signin-with-chatgpt?return_to=/', { redirect: 'manual' });
const cookie = signed.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
async function post(path, body) {
  const response = await fetch(origin + path, { method: 'POST', headers: { origin, cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
}

const created = await post('/api/auction', { action: 'create', key: crypto.randomUUID(), name: 'Closeout verification', organization: 'Closeout Test Fund' });
assert.equal(created.status, 200, JSON.stringify(created.data));
const publicAuction = await (await fetch(origin + '/api/auction?id=' + created.data.id)).json();
const joined = await post('/api/nonprofit', { action: 'join', slug: publicAuction.nonprofit.slug, auctionId: created.data.id, item: '101', name: 'Closeout Tester' });
assert.equal(joined.status, 200, JSON.stringify(joined.data));
const placed = await post('/api/auction', { action: 'bid', id: created.data.id, item: '101', amount: 30000, key: crypto.randomUUID() });
assert.equal(placed.status, 200, JSON.stringify(placed.data));

let response = await fetch(origin + '/api/closeout?auction=' + created.data.id, { headers: { cookie } });
assert.equal(response.status, 200);
let closeout = await response.json();
assert.equal(closeout.participants.length, 1);
assert.deepEqual(closeout.participants[0].activity, ['Bidder only']);
assert.equal(closeout.participants[0].paymentStatus, 'not_collected_test_mode');

const updated = await post('/api/closeout', { auctionId: created.data.id, userId: closeout.participants[0].userId, pickupStatus: 'not_applicable', followupStatus: 'complete' });
assert.equal(updated.status, 200, JSON.stringify(updated.data));
response = await fetch(origin + '/api/closeout?auction=' + created.data.id, { headers: { cookie } });
closeout = await response.json();
assert.equal(closeout.participants[0].followupStatus, 'complete');
assert.equal(closeout.participants[0].pickupStatus, 'not_applicable');

const denied = await fetch(origin + '/api/closeout?auction=' + created.data.id);
assert.equal(denied.status, 401);
console.log('PASS: owner-only closeout report, participant rollup, explicit test payment state, and persistent action statuses.');

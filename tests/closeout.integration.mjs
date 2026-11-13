import assert from 'node:assert/strict';
import { integrationOrigin as origin, stagingSession } from './helpers/staging-session.mjs';

const cookie = await stagingSession(process.env.STAGING_ORGANIZER_EMAIL || 'nonprofit@giveholidays.com', { accountType: 'organizer' });
const bidderCookie = await stagingSession(process.env.STAGING_BIDDER_EMAIL || 'bidder@giveholidays.com', { accountType: 'supporter' });
const isoDate = offset => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
async function post(path, body, sessionCookie = cookie) {
  const response = await fetch(origin + path, { method: 'POST', headers: { origin, cookie: sessionCookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
}

const created = await post('/api/auction', { action: 'create', key: crypto.randomUUID(), name: 'Closeout verification', organization: 'Closeout Test Fund', openDate: isoDate(-1), closeDate: isoDate(7) });
assert.equal(created.status, 200, JSON.stringify(created.data));
const publicAuction = await (await fetch(origin + '/api/auction?id=' + created.data.id)).json();
const itemId = publicAuction.state.items[0].id;
const joined = await post('/api/nonprofit', { action: 'join', slug: publicAuction.nonprofit.slug, auctionId: created.data.id, item: itemId, name: 'Closeout Tester' }, bidderCookie);
assert.equal(joined.status, 200, JSON.stringify(joined.data));
const placed = await post('/api/auction', { action: 'bid', id: created.data.id, item: itemId, amount: 30000, key: crypto.randomUUID() }, bidderCookie);
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

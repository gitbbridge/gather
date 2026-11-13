import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { integrationOrigin as origin, stagingSession } from './helpers/staging-session.mjs';
const cookie = await stagingSession(process.env.STAGING_ORGANIZER_EMAIL || 'nonprofit@giveholidays.com', { accountType: 'organizer' });
const isoDate = offset => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
async function post(path, body) { const response = await fetch(origin + path, { method: 'POST', headers: { origin, cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: response.status, data: await response.json() }; }

const created = await post('/api/auction', { action: 'create', key: crypto.randomUUID(), name: 'Homepage verification auction', organization: 'Homepage Verification Fund', openDate: isoDate(-1), closeDate: isoDate(7) });
assert.equal(created.status, 200, JSON.stringify(created.data));
const auctionResponse = await fetch(origin + '/api/auction?id=' + created.data.id, { headers: { cookie } });
const auctionData = await auctionResponse.json();
const loadedResponse = await fetch(origin + '/api/homepage?nonprofit=' + auctionData.nonprofit.id, { headers: { cookie } });
assert.equal(loadedResponse.status, 200);
const loaded = await loadedResponse.json();
assert.equal(loaded.version, 0);
assert.ok(loaded.auctions.some(auction => auction.id === created.data.id));
const hero = loaded.config.sections.find(section => section.type === 'hero');
hero.heading = 'A verified homepage heading';
const contact = loaded.config.sections.find(section => section.type === 'contact');
contact.email = 'hello@example.org';

const saved = await post('/api/homepage', { action: 'save', nonprofitId: loaded.nonprofit.id, baseVersion: 0, config: loaded.config });
assert.equal(saved.status, 200, JSON.stringify(saved.data));
assert.equal(saved.data.version, 1);
const conflict = await post('/api/homepage', { action: 'save', nonprofitId: loaded.nonprofit.id, baseVersion: 0, config: loaded.config });
assert.equal(conflict.status, 409);
const published = await post('/api/homepage', { action: 'publish', nonprofitId: loaded.nonprofit.id, baseVersion: 1, config: loaded.config });
assert.equal(published.status, 200, JSON.stringify(published.data));
const publicPage = await fetch(origin + '/n/' + loaded.nonprofit.slug);
assert.equal(publicPage.status, 200);
assert.match(await publicPage.text(), /A verified homepage heading/);
const anonymousEditor = await fetch(origin + '/api/homepage');
assert.equal(anonymousEditor.status, 401);
execFileSync(process.execPath, ['--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'DB', '--local', '--config', 'dist/server/wrangler.json', '--persist-to', '.wrangler/state', '--command', `UPDATE nonprofits SET owner='homepage_other_owner' WHERE id='${loaded.nonprofit.id}'`], { stdio: 'pipe' });
const crossTenantRead = await fetch(origin + '/api/homepage?nonprofit=' + loaded.nonprofit.id, { headers: { cookie } });
assert.equal(crossTenantRead.status, 404);
const crossTenantWrite = await post('/api/homepage', { action: 'save', nonprofitId: loaded.nonprofit.id, baseVersion: published.data.version, config: loaded.config });
assert.equal(crossTenantWrite.status, 403);
console.log('PASS: organizer-only draft loading, real auction references, optimistic save conflict, explicit publish, public rendering, and tenant isolation.');

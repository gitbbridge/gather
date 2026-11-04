import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAuction } from '../lib/auction.ts';
import { defaultHomepage, homepageConfigSchema, homepageReadiness, safeLink } from '../lib/homepage.ts';

const nonprofit = { id: 'nonprofit-1', slug: 'community-fund-nonprofit', name: 'Community Fund', headline: 'Neighbors helping neighbors.', mission: 'We connect local families with practical support and lasting opportunity.', accent: '#175b47' };
const auctions = [{ id: 'auction-1', state: createAuction('Spring Benefit', nonprofit.name) }];

test('default homepage preserves nonprofit content and real auction references', () => {
  const config = defaultHomepage(nonprofit, auctions);
  assert.equal(homepageConfigSchema.safeParse(config).success, true);
  assert.ok(JSON.stringify(config).includes(nonprofit.headline));
  assert.ok(JSON.stringify(config).includes('auction-1'));
});

test('publish readiness flags missing organizer input and clears when supplied', () => {
  const config = defaultHomepage(nonprofit, auctions);
  assert.deepEqual(homepageReadiness(config, auctions), ['Contact & social: add at least one contact method.']);
  const contact = config.sections.find(section => section.type === 'contact');
  assert.ok(contact && contact.type === 'contact');
  contact.email = 'hello@example.org';
  assert.deepEqual(homepageReadiness(config, auctions), []);
});

test('homepage schema and renderer links reject unsafe destinations', () => {
  const config = defaultHomepage(nonprofit, auctions);
  const hero = config.sections.find(section => section.type === 'hero');
  assert.ok(hero && hero.type === 'hero');
  hero.primaryUrl = 'javascript:alert(1)';
  assert.equal(homepageConfigSchema.safeParse(config).success, false);
  assert.equal(safeLink('javascript:alert(1)'), '#');
  assert.equal(safeLink('/n/community-fund'), '/n/community-fund');
});

test('auction page builder clearly separates drafts, publishing, and the live page', () => {
  const builder = readFileSync(new URL('../app/homepage/homepage-builder.tsx', import.meta.url), 'utf8');
  const basics = readFileSync(new URL('../app/nonprofit-settings.tsx', import.meta.url), 'utf8');
  assert.match(builder, /Auction page ·/);
  assert.match(builder, /Draft preview · links are disabled/);
  assert.match(builder, /View live page/);
  assert.match(builder, /queuedAction/);
  assert.match(basics, /Open page builder/);
  assert.match(basics, /Your shareable auction-page link/);
});

test('Gather homepage states the focused auction and risk-free travel position', () => {
  const landing = readFileSync(new URL('../app/landing-page.tsx', import.meta.url), 'utf8');
  assert.match(landing, /A simpler auction\. More for your mission\./);
  assert.match(landing, /Everything a silent auction needs\. Nothing it doesn’t\./);
  assert.match(landing, /fulfillment obligation only after the winning bidder pays/);
  assert.doesNotMatch(landing, /destination placeholders/);
});
